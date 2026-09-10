/**
 * Core simulation types. The engine is UI-agnostic and side-effect free so it
 * could later run on a server unchanged.
 */

/** A line on the pitch. A player's natural position and a formation slot both map to one. */
export type Line = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface PlayerRatings {
  pace: number
  shooting: number
  passing: number
  defending: number
  physical: number
  position: Line
}

export interface Player {
  id: string
  name: string
  shirtNumber: number
  ratings: PlayerRatings
}

export interface FormationSlot {
  id: string
  line: Line
  /** Position on the pitch, 0-100. x is across the width, y runs from own goal (0) to opponent goal (100). */
  x: number
  y: number
  label: string
}

export interface SlotAssignment {
  slot: FormationSlot
  player: Player
}

/** Phase multipliers a formation applies to the aggregated team strength. */
export interface FormationEffect {
  attack: number
  midfield: number
  defence: number
  /** Scales the xG roll of every chance the team creates. */
  chanceQuality: number
}

/** Team instructions the engine plays with. Balanced/mid/normal is neutral. */
export interface Tactics {
  /** Where the block sits and how many bodies commit forward. */
  mentality: 'defensive' | 'balanced' | 'attacking'
  /** How high the team hunts the ball without it. */
  pressing: 'low' | 'mid' | 'high'
  /** Wide crosses vs central combinations, and defensive compactness. */
  width: 'narrow' | 'normal' | 'wide'
}

export interface TeamSheet {
  teamId: string
  name: string
  /** Accent color (hex) used by the UI; carried through events for convenience. */
  color: string
  /** Formation name (e.g. "4-2-4"), cited in event reasoning. */
  formation?: string
  /** The formation's phase multipliers; defaults to all 1s. */
  modifiers?: FormationEffect
  /** Team instructions; defaults to balanced / mid / normal (no effect). */
  tactics?: Tactics
  /**
   * Results-fitted baseline for this team, plus the reference value of the
   * REAL XI's player-aggregate attack/defence (real formation applied). The
   * engine anchors to the baseline and shifts it by the ratio of the current
   * lineup's aggregate to the reference — so the real XI in the real
   * formation reproduces the baseline exactly.
   */
  anchor?: {
    attack: number
    defence: number
    reference: { attack: number; defence: number }
  }
  starters: SlotAssignment[]
  bench: Player[]
}

export interface OutOfPositionFlag {
  playerId: string
  playerName: string
  slotId: string
  slotLabel: string
  naturalLine: Line
  slotLine: Line
  penalty: number
}

export interface TeamStrength {
  attack: number
  midfield: number
  defence: number
  goalkeeping: number
  flags: OutOfPositionFlag[]
}

export type Side = 'home' | 'away'

export interface Score {
  home: number
  away: number
}

export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'shot-saved'
  | 'shot-miss'
  | 'shot-blocked'
  | 'corner'
  | 'penalty'
  | 'yellow-card'
  | 'red-card'
  | 'momentum'
  | 'sub-window'
  | 'extra-time'
  | 'penalties'
  | 'full-time'

/** Event types that are a shot at goal (goal or not). */
export const SHOT_EVENT_TYPES: ReadonlySet<MatchEventType> = new Set([
  'goal',
  'shot-saved',
  'shot-miss',
  'shot-blocked',
])

export function isShotEvent(event: { type: MatchEventType }): boolean {
  return SHOT_EVENT_TYPES.has(event.type)
}

/** How a chance came about. */
export type ChanceSource = 'open-play' | 'counter' | 'corner' | 'free-kick' | 'penalty'

/**
 * A point on the pitch in the ACTING side's attacking frame: x runs from that
 * side's own goal line (0) to the goal it is attacking (1); y runs across the
 * pitch from the attacker's left touchline (0) to the right (1). Renderers
 * flip it into world space with the side and the period (teams change ends).
 */
export interface PitchPoint {
  x: number
  y: number
}

export interface MatchEvent {
  minute: number
  type: MatchEventType
  /** Missing on neutral events (kickoff, sub-window, full-time). */
  side?: Side
  teamId?: string
  player?: Player
  /** The player whose pass or cross set up a goal, when there was one. */
  assist?: Player
  /** Expected-goals value of the chance, present on shot/goal events. */
  xg?: number
  /** Where it happened, in the acting side's attacking frame (shots, fouls, corners, penalties). */
  spot?: PitchPoint
  /** How a chance came about (shot events). */
  source?: ChanceSource
  /** Headers are separated out: harder to convert, drawn differently. */
  header?: boolean
  /** Index into SimResult.sequences of the possession this event belongs to. */
  sequence?: number
  /** Score after this event resolved. */
  score: Score
  commentary: string
  /** The numbers behind the event, for the expandable "why did this happen" UI. */
  reasoning?: string
}

export interface SideStats {
  shots: number
  onTarget: number
  /** Shots that never reached the goal because a defender got in the way. */
  blocked: number
  goals: number
  xg: number
  /** Chances of big-chance quality (xG >= BIG_CHANCE_XG). */
  bigChances: number
  /** 0-100 */
  possession: number
  corners: number
  fouls: number
  /** Penalties awarded to this side. */
  penalties: number
  passes: number
  passesCompleted: number
  yellows: number
  reds: number
}

/** A chance at or above this xG counts as a big chance. */
export const BIG_CHANCE_XG = 0.3

/** One player's contribution, accumulated across the match. */
export interface PlayerMatchStats {
  playerId: string
  side: Side
  shots: number
  onTarget: number
  goals: number
  assists: number
  xg: number
  /** xG of the chances this player's passes created. */
  xa: number
  keyPasses: number
  passes: number
  passesCompleted: number
  /** Carries and dribbles that beat a man. */
  carries: number
  /** Successful defensive actions (tackles, interceptions, blocks). */
  tackles: number
  fouls: number
  foulsWon: number
  yellows: number
  red: boolean
  /** Goalkeepers only. */
  saves: number
}

export type BallAction =
  | 'restart'
  | 'pass'
  | 'carry'
  | 'through-ball'
  | 'cross'
  | 'cutback'
  | 'shot'
  | 'corner'
  | 'free-kick'
  | 'penalty'
  | 'turnover'
  | 'foul'
  | 'end'

/** One touch on the ball along a possession's path. */
export interface BallPathPoint {
  /** Fractional match minute of the touch. */
  t: number
  x: number
  y: number
  /** Player on the ball at this point (missing for a dead-ball restart spot). */
  playerId?: string
  /** The action that takes the ball on from this point. */
  action: BallAction
}

export type SequenceOutcome = 'shot' | 'turnover' | 'foul-won' | 'corner-won' | 'held'

/** One player on the pitch: identity plus the formation slot he occupies. */
export interface RosterEntry {
  playerId: string
  name: string
  shirtNumber: number
  slotId: string
  label: string
  line: Line
  /** Slot coordinates (0-100): x across the width, y from own goal to the opponent's. */
  x: number
  y: number
}

/** The XIs from a given minute on (kick-off, each restart after a pause). */
export interface LineupSnapshot {
  minute: number
  home: RosterEntry[]
  away: RosterEntry[]
}

/**
 * One possession: a chain of touches by one side in that side's attacking
 * frame, ending in a shot, a turnover, a foul or a corner. Every minute has
 * at least one, so the ball has a position at every moment of the match.
 */
export interface PossessionSequence {
  minute: number
  side: Side
  /** Fractional-minute window this possession occupies. */
  t0: number
  t1: number
  source: ChanceSource
  points: BallPathPoint[]
  outcome: SequenceOutcome
  /** Set when the possession ended with a shot: the chance's xG. */
  xg?: number
}

export interface XgTimelinePoint {
  minute: number
  home: number
  away: number
}

export interface MomentumTimelinePoint {
  minute: number
  /** -100 (away in total control) to 100 (home in total control), 0 = even. */
  value: number
}

export interface SimOptions {
  /** Knockout tie: play extra time when level at 90', then penalties. */
  knockout?: boolean
  /**
   * The home side's real possession share in this fixture (0-1). Blended with
   * the ratings-derived possession so chance creation feels like the actual game.
   */
  homePossession?: number
}

export type PenDirection = 'left' | 'center' | 'right'

export interface PenaltyKick {
  side: Side
  player: Player
  scored: boolean
  /** Where the ball went. */
  direction: PenDirection
  /** Where the keeper went. */
  dive: PenDirection
  /** True when the keeper stopped it; false with scored=false means off target. */
  saved: boolean
  /** Conversion probability the engine rolled against (0-1). */
  chance: number
  /** True when missing this kick would have lost (or all but lost) the shootout. */
  pressure: boolean
  /** Commentary line for the match report and shootout UI. */
  commentary: string
  /** Shootout tally after this kick. */
  scoreAfter: Score
}

export interface ShootoutResult {
  kicks: PenaltyKick[]
  score: Score
  winner: Side
}

export interface SimResult {
  seed: number
  /** Score after all playing time (extra time included, penalties excluded). */
  finalScore: Score
  /** Score at the 90-minute whistle. */
  regulationScore: Score
  wentToExtraTime: boolean
  shootout?: ShootoutResult
  /** Set in knockout mode: who goes through. */
  winner?: Side
  events: MatchEvent[]
  /** Cumulative xG per minute, for the race chart. */
  xgTimeline: XgTimelinePoint[]
  /** Home-tilt of possession per minute (-100..100), for the momentum view. */
  momentumTimeline: MomentumTimelinePoint[]
  stats: { home: SideStats; away: SideStats }
  /** Every possession of the match, in order: the ball's path minute by minute. */
  sequences: PossessionSequence[]
  /** Per-player contributions, keyed by player id. */
  playerStats: Record<string, PlayerMatchStats>
  /** Who was on the pitch from each restart: kick-off, then every pause where sheets could change. */
  lineupLog: LineupSnapshot[]
}

export interface ScorelineCount {
  home: number
  away: number
  count: number
}

export interface MonteCarloResult {
  runs: number
  baseSeed: number
  homeWinPct: number
  /** In knockout mode ties are always decided, so this is 0. */
  drawPct: number
  awayWinPct: number
  /** Share of knockout replays that needed extra time. */
  extraTimePct?: number
  /** Share of knockout replays that went all the way to penalties. */
  shootoutPct?: number
  topScorelines: ScorelineCount[]
  avgGoals: { home: number; away: number }
}
