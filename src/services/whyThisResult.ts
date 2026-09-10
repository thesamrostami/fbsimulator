import type { FormationName } from '../data/formations'
import { buildRealSheet, formationSlots, type MatchSideDef, type PlayedMatch } from '../data/matches'
import { TEAMS, type TeamInfo } from '../data/teams'
import { computeSheetStrength } from '../engine/ratings'
import { DEFAULT_TACTICS, describeTactics } from '../engine/tactics'
import type { OutOfPositionFlag, Tactics, TeamStrength } from '../engine/types'
import { buildSheet, sameTactics, type LineupState, type SideKey } from '../state/appState'

/**
 * The numbers behind one simulation setup: which phase gaps favoured whom,
 * which players were out of position, and how the user's edits moved each
 * team's phase ratings against the real starting XI. Pure — computed from the
 * match definition and the lineups the sim actually used.
 */

export type PhaseKey = 'attack' | 'midfield' | 'defence' | 'goalkeeping'

const PHASE_LABEL: Record<PhaseKey, string> = {
  attack: 'Attack',
  midfield: 'Midfield',
  defence: 'Defence',
  goalkeeping: 'Goalkeeping',
}

export interface PhaseGap {
  phase: PhaseKey
  label: string
  home: number
  away: number
  /** Positive means the home side is stronger. */
  gap: number
  advantage: TeamInfo
}

export interface PhaseShift {
  team: TeamInfo
  phase: PhaseKey
  label: string
  before: number
  after: number
}

export interface SideExplanation {
  team: TeamInfo
  flags: OutOfPositionFlag[]
}

export interface FormationChange {
  team: TeamInfo
  from: FormationName
  to: FormationName
}

export interface TacticsChange {
  team: TeamInfo
  from: Tactics
  to: Tactics
  /** The new instructions in words ("attacking mentality, high press"), or the neutral setting spelled out. */
  summary: string
}

export interface WhyThisResult {
  /** All four phase comparisons for the lineups the sim used, biggest gap first. */
  gaps: PhaseGap[]
  /** Out-of-position penalties in play, per side. */
  outOfPosition: SideExplanation[]
  /** before → after phase changes caused by the user's edits (empty when untouched). */
  shifts: PhaseShift[]
  /** Formations the user switched away from the real shape. */
  formationChanges: FormationChange[]
  /** Team instructions the user moved off the neutral setting the real match is replayed with. */
  tacticsChanges: TacticsChange[]
  /** True when the user changed anything from the real starting XIs. */
  edited: boolean
  /** The real possession split that weighted chance creation. */
  possession: { home: number; away: number }
}

function sideEdited(sideDef: MatchSideDef, lineup: LineupState): boolean {
  if (lineup.formation !== sideDef.formation) return true
  if (!sameTactics(lineup.tactics, DEFAULT_TACTICS)) return true
  const slots = formationSlots(sideDef.formation)
  return slots.some((slot, i) => lineup.startersBySlot[slot.id] !== sideDef.starters[i])
}

/** Instruction changes between two lineup snapshots, per side. */
export function tacticsChangesBetween(
  match: PlayedMatch,
  before: Record<SideKey, LineupState>,
  after: Record<SideKey, LineupState>,
): TacticsChange[] {
  const changes: TacticsChange[] = []
  for (const key of ['home', 'away'] as const) {
    if (sameTactics(before[key].tactics, after[key].tactics)) continue
    const summary = describeTactics(after[key].tactics) || 'balanced, mid press, normal width'
    changes.push({ team: TEAMS[match[key].teamId], from: before[key].tactics, to: after[key].tactics, summary })
  }
  return changes
}

function phases(strength: TeamStrength): Record<PhaseKey, number> {
  return {
    attack: strength.attack,
    midfield: strength.midfield,
    defence: strength.defence,
    goalkeeping: strength.goalkeeping,
  }
}

const round = (value: number): number => Math.round(value)

function shiftsBetween(
  teams: Record<SideKey, TeamInfo>,
  before: Record<SideKey, Record<PhaseKey, number>>,
  after: Record<SideKey, Record<PhaseKey, number>>,
): PhaseShift[] {
  const shifts: PhaseShift[] = []
  for (const key of ['home', 'away'] as const) {
    for (const phase of Object.keys(PHASE_LABEL) as PhaseKey[]) {
      if (round(before[key][phase]) !== round(after[key][phase])) {
        shifts.push({
          team: teams[key],
          phase,
          label: PHASE_LABEL[phase],
          before: round(before[key][phase]),
          after: round(after[key][phase]),
        })
      }
    }
  }
  return shifts
}

/**
 * before → after phase changes between two editable lineup snapshots — the
 * half-time editor's "why the odds moved", measured against the XIs that
 * finished the first half rather than the real starting XIs.
 */
export function buildHalftimeShifts(
  match: PlayedMatch,
  before: Record<SideKey, LineupState>,
  after: Record<SideKey, LineupState>,
): PhaseShift[] {
  const strengthsOf = (lineups: Record<SideKey, LineupState>) => ({
    home: phases(computeSheetStrength(buildSheet(match.home, lineups.home))),
    away: phases(computeSheetStrength(buildSheet(match.away, lineups.away))),
  })
  return shiftsBetween(
    { home: TEAMS[match.home.teamId], away: TEAMS[match.away.teamId] },
    strengthsOf(before),
    strengthsOf(after),
  )
}

export function buildWhyThisResult(
  match: PlayedMatch,
  lineups: Record<SideKey, LineupState>,
): WhyThisResult {
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]

  // Formation modifiers included: these are the numbers the engine played with.
  const used = {
    home: computeSheetStrength(buildSheet(match.home, lineups.home)),
    away: computeSheetStrength(buildSheet(match.away, lineups.away)),
  }
  const real = {
    home: computeSheetStrength(buildRealSheet(match.home)),
    away: computeSheetStrength(buildRealSheet(match.away)),
  }

  const usedPhases = { home: phases(used.home), away: phases(used.away) }

  const gaps: PhaseGap[] = (Object.keys(PHASE_LABEL) as PhaseKey[])
    .map((phase) => {
      const h = round(usedPhases.home[phase])
      const a = round(usedPhases.away[phase])
      return {
        phase,
        label: PHASE_LABEL[phase],
        home: h,
        away: a,
        gap: h - a,
        advantage: h >= a ? home : away,
      }
    })
    .sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap))

  const outOfPosition: SideExplanation[] = (
    [
      { team: home, flags: used.home.flags },
      { team: away, flags: used.away.flags },
    ] as SideExplanation[]
  ).filter((side) => side.flags.length > 0)

  const shifts = shiftsBetween(
    { home, away },
    { home: phases(real.home), away: phases(real.away) },
    usedPhases,
  )

  const formationChanges: FormationChange[] = (
    [
      ['home', home],
      ['away', away],
    ] as const
  )
    .filter(([key]) => lineups[key].formation !== match[key].formation)
    .map(([key, team]) => ({ team, from: match[key].formation, to: lineups[key].formation }))

  const neutral = { ...DEFAULT_TACTICS }
  const tacticsChanges = tacticsChangesBetween(
    match,
    { home: { ...lineups.home, tactics: neutral }, away: { ...lineups.away, tactics: neutral } },
    lineups,
  )

  const edited = sideEdited(match.home, lineups.home) || sideEdited(match.away, lineups.away)

  return { gaps, outOfPosition, shifts, formationChanges, tacticsChanges, edited, possession: match.real.possession }
}
