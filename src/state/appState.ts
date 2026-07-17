import { autoAssignFormation, FORMATIONS, formationSlots, type FormationName } from '../data/formations'
import { anchorFor, type MatchSideDef, type PlayedMatch } from '../data/matches'
import { getPlayer } from '../data/players'
import { SQUADS } from '../data/squads'
import { TEAMS } from '../data/teams'
import type { HalftimeState } from '../engine/simulate'
import type { MonteCarloResult, SimResult, TeamSheet } from '../engine/types'

export type Screen = 'editor' | 'match' | 'result'
export type SideKey = 'home' | 'away'

export interface LineupState {
  formation: FormationName
  startersBySlot: Record<string, string>
  bench: string[]
}

/** A tappable place a player can occupy: a formation slot or a bench seat. */
export type ChipLocation = { kind: 'slot'; slotId: string } | { kind: 'bench'; index: number }

export function sameLocation(a: ChipLocation, b: ChipLocation): boolean {
  if (a.kind === 'slot' && b.kind === 'slot') return a.slotId === b.slotId
  if (a.kind === 'bench' && b.kind === 'bench') return a.index === b.index
  return false
}

export interface MatchAppState {
  screen: Screen
  lineups: Record<SideKey, LineupState>
  /** Live engine state from kickoff, frozen at 45'; null before kickoff and after a restore. */
  firstHalf: HalftimeState | null
  /** The full result — null from kickoff until the second half has been played. */
  sim: SimResult | null
  monteCarlo: MonteCarloResult | null
}

export type MatchAppAction =
  | { type: 'swap'; side: SideKey; a: ChipLocation; b: ChipLocation }
  | { type: 'formation'; side: SideKey; formation: FormationName }
  | { type: 'reset'; side: SideKey; sideDef: MatchSideDef }
  | { type: 'first-half'; firstHalf: HalftimeState; monteCarlo: MonteCarloResult }
  | { type: 'second-half'; sim: SimResult }
  | { type: 'restore'; sim: SimResult; monteCarlo: MonteCarloResult; lineups: Record<SideKey, LineupState> }
  | { type: 'screen'; screen: Screen }

/**
 * The editable bench for one side: the whole verified squad minus the XI
 * (ordered GK → DEF → MID → FWD as in squads.ts). Falls back to the featured
 * matchday bench when a squad is unverified.
 */
export function benchFor(sideDef: MatchSideDef): string[] {
  const squad = SQUADS[sideDef.teamId]
  if (!squad?.verified) return [...sideDef.bench]
  const starters = new Set(sideDef.starters)
  return squad.players.filter((id) => !starters.has(id))
}

export function realLineupState(sideDef: MatchSideDef): LineupState {
  const slots = formationSlots(sideDef.formation)
  return {
    formation: sideDef.formation,
    startersBySlot: Object.fromEntries(slots.map((slot, i) => [slot.id, sideDef.starters[i]])),
    bench: benchFor(sideDef),
  }
}

export function initialMatchState(match: PlayedMatch): MatchAppState {
  return {
    screen: 'editor',
    lineups: { home: realLineupState(match.home), away: realLineupState(match.away) },
    firstHalf: null,
    sim: null,
    monteCarlo: null,
  }
}

function playerAt(lineup: LineupState, loc: ChipLocation): string {
  return loc.kind === 'slot' ? lineup.startersBySlot[loc.slotId] : lineup.bench[loc.index]
}

function withPlayerAt(lineup: LineupState, loc: ChipLocation, playerId: string): LineupState {
  if (loc.kind === 'slot') {
    return { ...lineup, startersBySlot: { ...lineup.startersBySlot, [loc.slotId]: playerId } }
  }
  const bench = [...lineup.bench]
  bench[loc.index] = playerId
  return { ...lineup, bench }
}

export function matchAppReducer(state: MatchAppState, action: MatchAppAction): MatchAppState {
  switch (action.type) {
    case 'swap': {
      if (sameLocation(action.a, action.b)) return state
      const lineup = state.lineups[action.side]
      const first = playerAt(lineup, action.a)
      const second = playerAt(lineup, action.b)
      const swapped = withPlayerAt(withPlayerAt(lineup, action.a, second), action.b, first)
      return { ...state, lineups: { ...state.lineups, [action.side]: swapped } }
    }
    case 'formation': {
      const lineup = state.lineups[action.side]
      if (lineup.formation === action.formation) return state
      // Re-seat the current XI into the new shape by natural position.
      const orderedStarters = formationSlots(lineup.formation).map((slot) => {
        const playerId = lineup.startersBySlot[slot.id]
        return { playerId, natural: getPlayer(playerId).ratings.position }
      })
      const startersBySlot = autoAssignFormation(orderedStarters, action.formation)
      return {
        ...state,
        lineups: {
          ...state.lineups,
          [action.side]: { ...lineup, formation: action.formation, startersBySlot },
        },
      }
    }
    case 'reset':
      return {
        ...state,
        lineups: { ...state.lineups, [action.side]: realLineupState(action.sideDef) },
      }
    case 'first-half':
      return { ...state, firstHalf: action.firstHalf, sim: null, monteCarlo: action.monteCarlo, screen: 'match' }
    case 'second-half':
      // The match screen keeps playing from 45' — the screen doesn't change.
      return { ...state, sim: action.sim }
    case 'restore':
      // Re-derived from the session-stored seed: jump straight to the result.
      return { lineups: action.lineups, firstHalf: null, sim: action.sim, monteCarlo: action.monteCarlo, screen: 'result' }
    case 'screen':
      return { ...state, screen: action.screen }
  }
}

// ── Half-time substitution rules ─────────────────────────────────────────────

/** Personnel-change cap at the break, as in real football. */
export const MAX_HALFTIME_SUBS = 5

/**
 * How many players in the new XI did not start the (predecessor) XI. A
 * formation-only reshuffle of the same 11 counts as 0 — only fresh personnel
 * count as substitutions.
 */
export function countPersonnelChanges(
  originalStarters: Record<string, string>,
  newStarters: Record<string, string>,
): number {
  const before = new Set(Object.values(originalStarters))
  return Object.values(newStarters).filter((id) => !before.has(id)).length
}

/**
 * Reducer for the half-time editor: the same swap/formation actions as
 * matchAppReducer over bare lineups, except a swap that would exceed
 * MAX_HALFTIME_SUBS personnel changes vs the XI that finished the first half
 * is rejected outright, and 'reset' returns to that XI (not the real one).
 */
export function makeHalftimeReducer(firstHalf: Record<SideKey, LineupState>) {
  return (
    lineups: Record<SideKey, LineupState>,
    action: MatchAppAction,
  ): Record<SideKey, LineupState> => {
    if (action.type === 'reset') return { ...lineups, [action.side]: firstHalf[action.side] }
    if (action.type !== 'swap' && action.type !== 'formation') return lineups
    const next = matchAppReducer(
      { screen: 'editor', lineups, firstHalf: null, sim: null, monteCarlo: null },
      action,
    ).lineups
    if (
      action.type === 'swap' &&
      countPersonnelChanges(firstHalf[action.side].startersBySlot, next[action.side].startersBySlot) >
        MAX_HALFTIME_SUBS
    ) {
      return lineups
    }
    return next
  }
}

/** Materialise the engine's TeamSheet from the current editable lineup. */
export function buildSheet(sideDef: MatchSideDef, lineup: LineupState): TeamSheet {
  const team = TEAMS[sideDef.teamId]
  return {
    teamId: team.id,
    name: team.name,
    color: team.color,
    formation: lineup.formation,
    modifiers: FORMATIONS[lineup.formation].modifiers,
    anchor: anchorFor(sideDef),
    starters: formationSlots(lineup.formation).map((slot) => ({
      slot,
      player: getPlayer(lineup.startersBySlot[slot.id]),
    })),
    bench: lineup.bench.map(getPlayer),
  }
}
