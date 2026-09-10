import { autoAssignFormation, FORMATIONS, formationSlots, type FormationName } from '../data/formations'
import { anchorFor, type MatchSideDef, type PlayedMatch } from '../data/matches'
import { getPlayer } from '../data/players'
import { SQUADS } from '../data/squads'
import { TEAMS } from '../data/teams'
import type { HalftimeState } from '../engine/simulate'
import { DEFAULT_TACTICS } from '../engine/tactics'
import type { MonteCarloResult, SimResult, Tactics, TeamSheet } from '../engine/types'
import type { MatchScript } from '../services/matchScript'

export type Screen = 'editor' | 'match' | 'result'
export type SideKey = 'home' | 'away'

export interface LineupState {
  formation: FormationName
  startersBySlot: Record<string, string>
  bench: string[]
  /** Team instructions; the real match is replayed with the neutral setting. */
  tactics: Tactics
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
  /** The kick-off lineups (editable before kick-off; the insight's "your XI"). */
  lineups: Record<SideKey, LineupState>
  /** The live engine handle, frozen at a pause; null before kick-off and after a restore. */
  live: HalftimeState | null
  /** The minute the live handle is frozen at — bumps on every pause so memos refresh. */
  pausedAt: number | null
  /** The match as data: seed, kick-off lineups and every confirmed change. */
  script: MatchScript | null
  /** The full result — null until the match has been played out. */
  sim: SimResult | null
  /** The kick-off insight; arrives from the worker shortly after kick-off. */
  monteCarlo: MonteCarloResult | null
}

export type MatchAppAction =
  | { type: 'swap'; side: SideKey; a: ChipLocation; b: ChipLocation }
  | { type: 'formation'; side: SideKey; formation: FormationName }
  | { type: 'tactics'; side: SideKey; tactics: Partial<Tactics> }
  | { type: 'reset'; side: SideKey; sideDef: MatchSideDef }
  | { type: 'kickoff'; live: HalftimeState; script: MatchScript }
  | { type: 'monte-carlo'; monteCarlo: MonteCarloResult }
  /** The match played on to the next pause (same handle, now frozen later). */
  | { type: 'paused'; live: HalftimeState; script: MatchScript }
  | { type: 'finished'; sim: SimResult; script: MatchScript }
  | { type: 'restore'; sim: SimResult; monteCarlo: MonteCarloResult | null; script: MatchScript }
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
    tactics: { ...DEFAULT_TACTICS },
  }
}

export function sameTactics(a: Tactics, b: Tactics): boolean {
  return a.mentality === b.mentality && a.pressing === b.pressing && a.width === b.width
}

export function initialMatchState(match: PlayedMatch): MatchAppState {
  return {
    screen: 'editor',
    lineups: { home: realLineupState(match.home), away: realLineupState(match.away) },
    live: null,
    pausedAt: null,
    script: null,
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
    case 'tactics': {
      const lineup = state.lineups[action.side]
      const tactics = { ...lineup.tactics, ...action.tactics }
      if (sameTactics(tactics, lineup.tactics)) return state
      return { ...state, lineups: { ...state.lineups, [action.side]: { ...lineup, tactics } } }
    }
    case 'reset':
      return {
        ...state,
        lineups: { ...state.lineups, [action.side]: realLineupState(action.sideDef) },
      }
    case 'kickoff':
      return {
        ...state,
        live: action.live,
        pausedAt: action.live.minutesPlayed,
        script: action.script,
        sim: null,
        monteCarlo: null,
        screen: 'match',
      }
    case 'monte-carlo':
      return { ...state, monteCarlo: action.monteCarlo }
    case 'paused':
      // The match screen keeps playing — only the frozen minute moves.
      return { ...state, live: action.live, pausedAt: action.live.minutesPlayed, script: action.script }
    case 'finished':
      return { ...state, sim: action.sim, script: action.script }
    case 'restore':
      // Re-derived from the stored script: jump straight to the result.
      return {
        lineups: action.script.lineups,
        live: null,
        pausedAt: null,
        script: action.script,
        sim: action.sim,
        monteCarlo: action.monteCarlo,
        screen: 'result',
      }
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

/** Substitution allowance for a pause: what was used before it and who can no longer play. */
export interface PauseAllowance {
  /** Confirmed substitutions before this pause, per side. */
  used: Record<SideKey, number>
  /** Players who have left the pitch for good (substituted off or sent off), per side. */
  unavailable: Record<SideKey, ReadonlySet<string>>
}

const NO_ALLOWANCE: PauseAllowance = {
  used: { home: 0, away: 0 },
  unavailable: { home: new Set(), away: new Set() },
}

/**
 * Reducer for a pause editor (half-time or a substitution window): the same
 * swap/formation/tactics actions as matchAppReducer over bare lineups,
 * except a swap is rejected outright when it would exceed the match's
 * MAX_HALFTIME_SUBS personnel changes (earlier windows included) or bring
 * back a player who has already left the pitch; 'reset' returns to the XI
 * on the pitch at the pause (not the real one).
 */
export function makePauseReducer(baseline: Record<SideKey, LineupState>, allowance: PauseAllowance = NO_ALLOWANCE) {
  return (
    lineups: Record<SideKey, LineupState>,
    action: MatchAppAction,
  ): Record<SideKey, LineupState> => {
    if (action.type === 'reset') return { ...lineups, [action.side]: baseline[action.side] }
    if (action.type !== 'swap' && action.type !== 'formation' && action.type !== 'tactics') return lineups
    const next = matchAppReducer(
      { screen: 'editor', lineups, live: null, pausedAt: null, script: null, sim: null, monteCarlo: null },
      action,
    ).lineups
    if (action.type === 'swap') {
      const side = action.side
      const fresh = countPersonnelChanges(baseline[side].startersBySlot, next[side].startersBySlot)
      if (allowance.used[side] + fresh > MAX_HALFTIME_SUBS) return lineups
      const xi = Object.values(next[side].startersBySlot)
      if (xi.some((id) => allowance.unavailable[side].has(id))) return lineups
    }
    return next
  }
}

/** Half-time is the first pause: nothing used yet, nobody gone (bar red cards, handled by the editor). */
export function makeHalftimeReducer(firstHalf: Record<SideKey, LineupState>) {
  return makePauseReducer(firstHalf)
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
    tactics: lineup.tactics,
    anchor: anchorFor(sideDef),
    starters: formationSlots(lineup.formation).map((slot) => ({
      slot,
      player: getPlayer(lineup.startersBySlot[slot.id]),
    })),
    bench: lineup.bench.map(getPlayer),
  }
}
