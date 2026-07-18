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

export interface TeamSheet {
  teamId: string
  name: string
  /** Accent color (hex) used by the UI; carried through events for convenience. */
  color: string
  /** Formation name (e.g. "4-2-4"), cited in event reasoning. */
  formation?: string
  /** The formation's phase multipliers; defaults to all 1s. */
  modifiers?: FormationEffect
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
  | 'yellow-card'
  | 'red-card'
  | 'momentum'
  | 'sub-window'
  | 'extra-time'
  | 'penalties'
  | 'full-time'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  /** Missing on neutral events (kickoff, sub-window, full-time). */
  side?: Side
  teamId?: string
  player?: Player
  /** Expected-goals value of the chance, present on shot/goal events. */
  xg?: number
  /** Score after this event resolved. */
  score: Score
  commentary: string
  /** The numbers behind the event, for the expandable "why did this happen" UI. */
  reasoning?: string
}

export interface SideStats {
  shots: number
  onTarget: number
  goals: number
  xg: number
  /** 0-100 */
  possession: number
  yellows: number
  reds: number
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
