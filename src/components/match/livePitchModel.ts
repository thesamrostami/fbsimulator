import { isShotEvent, type BallAction, type LineupSnapshot, type MatchEvent, type PitchPoint, type PossessionSequence, type RosterEntry, type Side } from '../../engine/types'
import { homeDir, PITCH } from './terrainModel'

/**
 * Pure model behind the live 3D pitch: where the ball is at a fractional
 * minute, who is on the pitch, and where every player should be standing.
 * No three.js here so it stays unit-testable. World space: the pitch is
 * PITCH.len long on X (goal to goal) and PITCH.wid wide on Z; home attacks
 * +X in the first half and the sides swap ends each period (homeDir).
 */

export interface WorldPoint {
  x: number
  z: number
}

/** Attacking-frame point of `side` → world, honouring which end they attack this period. */
export function toWorld(p: PitchPoint, side: Side, minute: number): WorldPoint {
  const dir = (side === 'home' ? 1 : -1) * homeDir(minute)
  return { x: (p.x - 0.5) * PITCH.len * dir, z: (p.y - 0.5) * PITCH.wid * dir }
}

export interface Roster {
  home: RosterEntry[]
  away: RosterEntry[]
}

/** Who is on the pitch at a minute: the latest restart's XIs minus anyone sent off by then. */
export function rosterAt(lineupLog: LineupSnapshot[], events: MatchEvent[], minute: number): Roster {
  let snapshot = lineupLog[0]
  for (const entry of lineupLog) if (entry.minute < minute || entry.minute === 0) snapshot = entry
  if (!snapshot) return { home: [], away: [] }
  const off = new Set(
    events.filter((e) => e.type === 'red-card' && e.player && e.minute <= minute).map((e) => e.player!.id),
  )
  return {
    home: snapshot.home.filter((p) => !off.has(p.playerId)),
    away: snapshot.away.filter((p) => !off.has(p.playerId)),
  }
}

export type ShotOutcome = 'goal' | 'saved' | 'miss' | 'blocked'

/** Per-sequence lookup of how its shot ended, for the ball's flight after the last touch. */
export function shotOutcomes(events: MatchEvent[]): Map<number, ShotOutcome> {
  const map = new Map<number, ShotOutcome>()
  for (const e of events) {
    if (!isShotEvent(e) || e.sequence === undefined) continue
    map.set(
      e.sequence,
      e.type === 'goal' ? 'goal' : e.type === 'shot-saved' ? 'saved' : e.type === 'shot-blocked' ? 'blocked' : 'miss',
    )
  }
  return map
}

/** Where a shot from `from` ends up, in the shooter's frame. */
export function shotTarget(from: PitchPoint, outcome: ShotOutcome): PitchPoint {
  // Deterministic spread from the spot so repeated scrubs show the same flight.
  const seed = Math.abs(Math.sin(from.x * 91.7 + from.y * 47.3))
  const spread = seed - 0.5
  switch (outcome) {
    case 'goal':
      return { x: 1.01, y: 0.5 + spread * 0.08 }
    case 'saved':
      return { x: 0.985, y: 0.5 + spread * 0.07 }
    case 'blocked':
      return { x: Math.min(from.x + 0.035, 0.99), y: from.y + spread * 0.02 }
    case 'miss':
      return { x: 1.04, y: 0.5 + (spread < 0 ? -1 : 1) * (0.075 + Math.abs(spread) * 0.06) }
  }
}

/** Peak height (world units) of the ball's arc for each kind of delivery. */
const ARC: Partial<Record<BallAction, number>> = {
  cross: 1.6,
  corner: 1.9,
  'through-ball': 0.35,
  'free-kick': 1.1,
  shot: 0.5,
  pass: 0.12,
  cutback: 0.1,
}

export interface BallState {
  world: WorldPoint
  /** Height above the turf. */
  y: number
  side: Side
  /** The player on the ball (the receiver once a pass lands), if any. */
  playerId?: string
  /** What the ball is doing right now. */
  action: BallAction | 'dead'
  sequence: number
  /** 0..1 progress along the current segment. */
  progress: number
  /** Start of the current segment, for pass lines. */
  segmentFrom?: WorldPoint
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Index of the last sequence starting at or before `minute` (binary search on t0). */
function sequenceIndexAt(sequences: PossessionSequence[], minute: number): number {
  let lo = 0
  let hi = sequences.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sequences[mid].t0 <= minute) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

/**
 * The ball at a fractional minute: interpolated along the touches of the
 * possession in progress, lofted for crosses and shots, flying to the net
 * (or the keeper, or wide) after a shot. Before the first possession the
 * ball sits on the centre spot.
 */
export function ballAt(
  sequences: PossessionSequence[],
  outcomes: Map<number, ShotOutcome>,
  minute: number,
): BallState {
  const idx = sequenceIndexAt(sequences, minute)
  if (idx < 0) {
    return { world: { x: 0, z: 0 }, y: 0, side: 'home', action: 'dead', sequence: -1, progress: 0 }
  }
  const seq = sequences[idx]
  const pts = seq.points
  const last = pts[pts.length - 1]
  const period = seq.minute

  // Find the segment.
  let i = 0
  while (i < pts.length - 1 && pts[i + 1].t <= minute) i++
  const from = pts[i]
  const to = pts[i + 1]

  if (to && minute < to.t) {
    const raw = (minute - from.t) / Math.max(to.t - from.t, 1e-6)
    const s = easeInOut(Math.max(0, Math.min(1, raw)))
    const p = { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s }
    const arc = ARC[from.action] ?? 0.12
    const dist = Math.hypot(to.x - from.x, (to.y - from.y) * 0.65)
    return {
      world: toWorld(p, seq.side, period),
      y: 4 * s * (1 - s) * arc * Math.min(1, dist * 3),
      side: seq.side,
      playerId: s > 0.85 ? to.playerId ?? from.playerId : from.playerId,
      action: from.action,
      sequence: idx,
      progress: s,
      segmentFrom: toWorld({ x: from.x, y: from.y }, seq.side, period),
    }
  }

  // Past the last touch: a shot flies on; anything else rests on the last spot.
  const outcome = outcomes.get(idx)
  if (last.action === 'shot' && outcome) {
    const target = shotTarget({ x: last.x, y: last.y }, outcome)
    const flight = Math.min(1, (minute - last.t) / Math.max((seq.t1 - last.t) * 0.55, 0.02))
    const p = { x: last.x + (target.x - last.x) * flight, y: last.y + (target.y - last.y) * flight }
    const peak = outcome === 'miss' ? 0.9 : outcome === 'blocked' ? 0.1 : 0.45
    return {
      world: toWorld(p, seq.side, period),
      y: 4 * flight * (1 - flight) * peak + (outcome === 'miss' ? flight * 0.6 : 0),
      side: seq.side,
      playerId: undefined,
      action: 'shot',
      sequence: idx,
      progress: flight,
      segmentFrom: toWorld({ x: last.x, y: last.y }, seq.side, period),
    }
  }
  return {
    world: toWorld({ x: last.x, y: last.y }, seq.side, period),
    y: 0,
    side: seq.side,
    playerId: last.playerId,
    action: last.action === 'end' ? 'carry' : last.action,
    sequence: idx,
    progress: 1,
  }
}

/** Tunables for how the two blocks move with the ball. */
export const SHAPE = {
  /** How far the block in possession pushes toward the ball's depth (fraction of the gap). */
  attackPush: 0.45,
  /** How far the defending block drops toward its own goal. */
  defendDrop: 0.4,
  /** Lateral drift toward the ball's lane. */
  laneDrift: 0.3,
  /** Compactness of the defending block's depth. */
  defendCompress: 0.82,
  /** Keeper depth from his own goal line (attacking-frame x). */
  keeperDepth: 0.035,
  /** Nearest team-mates converge on the ball a little. */
  supportPull: 0.18,
} as const

/** Nominal attacking-frame spot of a formation slot. */
export function nominalSpot(entry: RosterEntry): PitchPoint {
  return { x: entry.y / 100, y: entry.x / 100 }
}

/**
 * Target positions for one side, in that side's attacking frame. The block
 * slides with the ball: in possession it pushes up behind the ball, out of
 * possession it drops and compacts in front of its own goal; everybody
 * drifts toward the ball's lane; the man on the ball stands on it.
 */
export function sideTargets(
  roster: RosterEntry[],
  ball: PitchPoint,
  inPossession: boolean,
  carrierId: string | undefined,
): Map<string, PitchPoint> {
  const out = new Map<string, PitchPoint>()
  const outfield = roster.filter((p) => p.line !== 'GK')
  const meanDepth = outfield.length
    ? outfield.reduce((sum, p) => sum + nominalSpot(p).x, 0) / outfield.length
    : 0.5
  // Where the block's centre wants to be.
  const centre = inPossession
    ? meanDepth + (ball.x - 0.12 - meanDepth) * SHAPE.attackPush
    : Math.min(meanDepth, ball.x - 0.05) - (meanDepth - Math.max(ball.x - 0.3, 0.12)) * SHAPE.defendDrop
  const shift = centre - meanDepth
  const compress = inPossession ? 1 : SHAPE.defendCompress

  for (const entry of roster) {
    const nominal = nominalSpot(entry)
    if (entry.playerId === carrierId) {
      out.set(entry.playerId, { x: ball.x, y: ball.y })
      continue
    }
    if (entry.line === 'GK') {
      out.set(entry.playerId, { x: SHAPE.keeperDepth, y: 0.5 + (ball.y - 0.5) * 0.2 })
      continue
    }
    let x = meanDepth + (nominal.x - meanDepth) * compress + shift
    let y = nominal.y + (ball.y - nominal.y) * SHAPE.laneDrift
    // Team-mates near the ball offer an option: pull toward it a touch.
    const d = Math.hypot(nominal.x + shift - ball.x, (nominal.y - ball.y) * 0.65)
    if (d < 0.22) {
      const pull = SHAPE.supportPull * (1 - d / 0.22)
      x += (ball.x - x) * pull
      y += (ball.y - y) * pull
    }
    out.set(entry.playerId, { x: clamp(x, 0.02, 0.98), y: clamp(y, 0.03, 0.97) })
  }
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Mirror a point into the other side's frame. */
export function mirrorPoint(p: PitchPoint): PitchPoint {
  return { x: 1 - p.x, y: 1 - p.y }
}

export interface PlayerTarget {
  playerId: string
  side: Side
  world: WorldPoint
}

/** Every player's target world position for the current ball state. */
export function playerTargets(roster: Roster, ball: BallState, minute: number, ballFrame: PitchPoint): PlayerTarget[] {
  const out: PlayerTarget[] = []
  for (const side of ['home', 'away'] as const) {
    const inPossession = ball.side === side && ball.action !== 'dead'
    const ballHere = ball.side === side ? ballFrame : mirrorPoint(ballFrame)
    const targets = sideTargets(roster[side], ballHere, inPossession, inPossession ? ball.playerId : undefined)
    for (const [playerId, p] of targets) out.push({ playerId, side, world: toWorld(p, side, minute) })
  }
  return out
}

/** The ball's attacking-frame point for its owning side, recovered from world space. */
export function ballFrameOf(ball: BallState, minute: number): PitchPoint {
  const dir = (ball.side === 'home' ? 1 : -1) * homeDir(minute)
  return { x: ball.world.x / (PITCH.len * dir) + 0.5, y: ball.world.z / (PITCH.wid * dir) + 0.5 }
}

/** Live counting stats for one player up to the playhead, from events and touches. */
export interface LiveLine {
  shots: number
  goals: number
  assists: number
  xg: number
  passes: number
  yellow: boolean
  red: boolean
}

export function liveLine(playerId: string, events: MatchEvent[], sequences: PossessionSequence[], minute: number): LiveLine {
  const line: LiveLine = { shots: 0, goals: 0, assists: 0, xg: 0, passes: 0, yellow: false, red: false }
  for (const e of events) {
    if (e.minute > minute) break
    if (isShotEvent(e)) {
      if (e.player?.id === playerId) {
        line.shots += 1
        line.xg += e.xg ?? 0
        if (e.type === 'goal') line.goals += 1
      }
      if (e.type === 'goal' && e.assist?.id === playerId) line.assists += 1
    } else if (e.type === 'yellow-card' && e.player?.id === playerId) line.yellow = true
    else if (e.type === 'red-card' && e.player?.id === playerId) line.red = true
  }
  for (const seq of sequences) {
    if (seq.minute > minute) break
    for (const p of seq.points) {
      if (p.playerId !== playerId || p.t > minute) continue
      if (p.action === 'pass' || p.action === 'cross' || p.action === 'through-ball' || p.action === 'cutback') line.passes += 1
    }
  }
  line.xg = Math.round(line.xg * 100) / 100
  return line
}
