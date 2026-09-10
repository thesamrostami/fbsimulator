import type { Commentator, CommentaryType, CommentaryContext } from './commentary'
import { effectiveRatings } from './ratings'
import type { Rng } from './rng'
import { tacticalProfile, type TacticalProfile } from './tactics'
import type {
  Line,
  LineupSnapshot,
  MatchEvent,
  MomentumTimelinePoint,
  PitchPoint,
  Player,
  PlayerMatchStats,
  PossessionSequence,
  Side,
  SideStats,
  SimOptions,
  SlotAssignment,
  TeamSheet,
  TeamStrength,
  XgTimelinePoint,
} from './types'

/**
 * Mutable engine state shared by the minute loop (simulate.ts) and the
 * possession mechanics (possession.ts). Nothing here is part of the public
 * result shape.
 */

// ── Zones ────────────────────────────────────────────────────────────────────

/** Zone centres: three thirds along the attack (x) by three lanes (y). */
const THIRD_X = [1 / 6, 1 / 2, 5 / 6] as const
const LANE_Y = [0.15, 0.5, 0.85] as const
/** How far a player's influence reaches from his nominal spot (attacking-frame units). */
const KERNEL_SIGMA = 0.22
/** Lanes matter less than depth for who gets involved. */
const LANE_WEIGHT = 0.6

export const ZONE_COUNT = 9

export function zoneIndex(p: PitchPoint): number {
  const t = p.x < 1 / 3 ? 0 : p.x < 2 / 3 ? 1 : 2
  const l = p.y < 0.3 ? 0 : p.y > 0.7 ? 2 : 1
  return t * 3 + l
}

const SHOOT_LINE_WEIGHT: Record<Line, number> = { GK: 0.02, DEF: 0.5, MID: 1.4, FWD: 3 }
const HEADER_LINE_WEIGHT: Record<Line, number> = { GK: 0.02, DEF: 1.1, MID: 0.9, FWD: 2.4 }

/**
 * Everything the possession mechanics need to know about one lineup, indexed
 * by zone: who is likely on the ball there, who shoots, who defends, and how
 * good the group covering each zone is. Rebuilt whenever the XI changes.
 */
export interface ZoneProfile {
  /** Index-aligned with every per-player weight array below. */
  players: SlotAssignment[]
  /** Who receives or carries the ball in each attacking-frame zone. */
  carrier: Float64Array[]
  /** Who shoots from each attacking-frame zone (feet). */
  shooter: Float64Array[]
  /** Who attacks a delivery in each attacking-frame zone (head). */
  header: Float64Array[]
  /**
   * Who makes the defensive action when the OPPONENT attacks zone z — indexed
   * by the attacker's zone, mirrored internally, so callers pass the zone the
   * ball is in from the attacker's point of view.
   */
  defender: Float64Array[]
  /** Ball-progression quality of the group covering each attacking-frame zone (0-99 scale). */
  progress: Float64Array
  /** Defensive quality against an opponent attacking zone z (attacker-indexed, 0-99 scale). */
  defence: Float64Array
  /** Foul propensity of the group defending against an attack on zone z (attacker-indexed). */
  aggression: Float64Array
  /** Mean pace of the front players (fast breaks) and of the back line (resisting them). */
  paceAttack: number
  paceDefence: number
  /** Index of the goalkeeper in `players`, or -1 with no keeper on the pitch. */
  gkIndex: number
  /** Best dead-ball taker (shooting + passing). */
  freeKickTaker: number
  /** Best penalty taker (shooting). */
  penaltyTaker: number
}

function kernel(ax: number, ay: number, zx: number, zy: number): number {
  const dx = ax - zx
  const dy = (ay - zy) * LANE_WEIGHT
  return Math.exp(-(dx * dx + dy * dy) / (2 * KERNEL_SIGMA * KERNEL_SIGMA))
}

export function buildZoneProfile(players: SlotAssignment[]): ZoneProfile {
  const n = players.length
  const eff = players.map(({ slot, player }) => effectiveRatings(player.ratings, slot.line))
  // Nominal spot in the attacking frame: depth from the formation's y, lane from its x.
  const ax = players.map(({ slot }) => slot.y / 100)
  const ay = players.map(({ slot }) => slot.x / 100)
  const isGk = players.map(({ slot }) => slot.line === 'GK')

  const carrier: Float64Array[] = []
  const shooter: Float64Array[] = []
  const header: Float64Array[] = []
  const defender: Float64Array[] = []
  const progress = new Float64Array(ZONE_COUNT)
  const defence = new Float64Array(ZONE_COUNT)
  const aggression = new Float64Array(ZONE_COUNT)

  for (let z = 0; z < ZONE_COUNT; z++) {
    const zx = THIRD_X[Math.floor(z / 3)]
    const zy = LANE_Y[z % 3]
    const c = new Float64Array(n)
    const s = new Float64Array(n)
    const h = new Float64Array(n)
    const d = new Float64Array(n)
    let progSum = 0
    let progW = 0
    let defSum = 0
    let defW = 0
    let aggSum = 0
    for (let i = 0; i < n; i++) {
      const k = kernel(ax[i], ay[i], zx, zy)
      const r = eff[i]
      const gkScale = isGk[i] ? 0.15 : 1
      c[i] = k * gkScale * Math.max((r.passing * 0.7 + r.pace * 0.3) / 80, 0.05)
      s[i] = k * SHOOT_LINE_WEIGHT[players[i].slot.line] * Math.max(r.shooting / 80, 0.05)
      h[i] = k * HEADER_LINE_WEIGHT[players[i].slot.line] * Math.max((r.physical * 0.6 + r.shooting * 0.4) / 80, 0.05)
      progSum += k * gkScale * (r.passing * 0.6 + r.pace * 0.25 + r.physical * 0.15)
      progW += k * gkScale
      if (!isGk[i]) {
        // The zone a defender covers is the mirror of the one the attacker sees.
        const kd = kernel(ax[i], ay[i], THIRD_X[2 - Math.floor(z / 3)], LANE_Y[2 - (z % 3)])
        const agg = r.defending * 0.6 + r.physical * 0.4
        d[i] = kd * Math.max(Math.sqrt(agg / 80), 0.05)
        defSum += kd * (r.defending * 0.6 + r.physical * 0.25 + r.pace * 0.15)
        defW += kd
        aggSum += kd * agg
      }
    }
    carrier.push(c)
    shooter.push(s)
    header.push(h)
    defender.push(d)
    progress[z] = progW > 0 ? progSum / progW : 60
    defence[z] = defW > 0 ? defSum / defW : 60
    aggression[z] = defW > 0 ? aggSum / defW : 60
  }

  const front = players.filter((a) => a.slot.line === 'FWD' || (a.slot.line === 'MID' && a.slot.y >= 55))
  const back = players.filter((a) => a.slot.line === 'DEF')
  const meanPace = (group: SlotAssignment[], fallback: number) =>
    group.length > 0 ? group.reduce((sum, a) => sum + a.player.ratings.pace, 0) / group.length : fallback

  let gkIndex = -1
  let freeKickTaker = 0
  let penaltyTaker = 0
  let bestFk = -1
  let bestPen = -1
  for (let i = 0; i < n; i++) {
    if (isGk[i]) {
      gkIndex = i
      continue
    }
    const fk = eff[i].shooting * 0.6 + eff[i].passing * 0.4
    if (fk > bestFk) {
      bestFk = fk
      freeKickTaker = i
    }
    if (eff[i].shooting > bestPen) {
      bestPen = eff[i].shooting
      penaltyTaker = i
    }
  }

  return {
    players,
    carrier,
    shooter,
    header,
    defender,
    progress,
    defence,
    aggression,
    paceAttack: meanPace(front, 70),
    paceDefence: meanPace(back, 70),
    gkIndex,
    freeKickTaker,
    penaltyTaker,
  }
}

// ── Side + match state ───────────────────────────────────────────────────────

export interface SideState {
  side: Side
  sheet: TeamSheet
  onPitch: SlotAssignment[]
  strength: TeamStrength
  profile: ZoneProfile
  tactics: TacticalProfile
  goals: number
  /** Largest deficit this side has faced — fuels "comeback" commentary. */
  maxDeficit: number
  /** Clearly weaker per the results-fitted baselines. */
  underdog: boolean
  boost: number
  boostUntil: number
  yellowsByPlayer: Map<string, number>
  stats: SideStats
}

export function emptySideStats(): SideStats {
  return {
    shots: 0,
    onTarget: 0,
    blocked: 0,
    goals: 0,
    xg: 0,
    bigChances: 0,
    possession: 0,
    corners: 0,
    fouls: 0,
    penalties: 0,
    passes: 0,
    passesCompleted: 0,
    yellows: 0,
    reds: 0,
  }
}

export function emptyPlayerStats(playerId: string, side: Side): PlayerMatchStats {
  return {
    playerId,
    side,
    shots: 0,
    onTarget: 0,
    goals: 0,
    assists: 0,
    xg: 0,
    xa: 0,
    keyPasses: 0,
    passes: 0,
    passesCompleted: 0,
    carries: 0,
    tackles: 0,
    fouls: 0,
    foulsWon: 0,
    yellows: 0,
    red: false,
    saves: 0,
  }
}

/** Where the ball is between possessions. */
export interface BallState {
  /** Which side has it (or restarts with it). */
  side: Side
  /** In that side's attacking frame. */
  point: PitchPoint
  /** A dead ball (goal kick, kick-off): the next possession starts from a restart, not this spot. */
  dead: boolean
}

export type Line3 = (type: CommentaryType, minute: number, ctx?: CommentaryContext) => string

export interface EngineContext {
  rng: Rng
  events: MatchEvent[]
  home: SideState
  away: SideState
  commentary: Commentator & { lineAt: Line3 }
  sequences: PossessionSequence[]
  players: Map<string, PlayerMatchStats>
  ball: BallState
  /** Remove a player for a red card and re-rate the side (provided by the minute loop). */
  sendOff: (side: SideState, player: Player) => void
  /** Momentum and story bookkeeping after a goal (provided by the minute loop). */
  onGoal: (scorer: SideState, conceder: SideState, minute: number) => void
}

/**
 * A match frozen at a whistle: the live rng, the commentator riding it and
 * both sides' mutable state, mid-stream. Internal engine handle, not part of
 * the public SimResult shape: it holds closures and shared mutable arrays on
 * purpose so a resumed match continues the exact same random stream and
 * pushes onto the same timelines. Not serializable.
 */
export interface HalftimeState extends EngineContext {
  lineupLog: LineupSnapshot[]
  xgTimeline: XgTimelinePoint[]
  momentumTimeline: MomentumTimelinePoint[]
  possessionHomeSum: number
  minutesPlayed: number
  options: SimOptions
  seed: number
}

export function playerStatsFor(ctx: EngineContext, playerId: string, side: Side): PlayerMatchStats {
  let entry = ctx.players.get(playerId)
  if (!entry) {
    entry = emptyPlayerStats(playerId, side)
    ctx.players.set(playerId, entry)
  }
  return entry
}

export function sideTactics(sheet: TeamSheet): TacticalProfile {
  return tacticalProfile(sheet.tactics)
}

/** Serializable roster of a side's starters, for the lineup log. */
export function rosterOf(starters: SlotAssignment[]): LineupSnapshot['home'] {
  return starters.map(({ slot, player }) => ({
    playerId: player.id,
    name: player.name,
    shirtNumber: player.shirtNumber,
    slotId: slot.id,
    label: slot.label,
    line: slot.line,
    x: slot.x,
    y: slot.y,
  }))
}
