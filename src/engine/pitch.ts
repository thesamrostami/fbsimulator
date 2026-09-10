import type { PitchPoint } from './types'

/**
 * Pitch geometry for the possession engine. Points live in the ACTING side's
 * attacking frame (see PitchPoint): x from own goal line (0) to the goal
 * being attacked (1), y from the attacker's left touchline (0) to the right
 * (1). Real dimensions convert that frame into metres for the xG model.
 */
export const PITCH_M = {
  length: 105,
  width: 68,
  /** Half the goal mouth (7.32 m). */
  goalHalf: 3.66,
  boxDepth: 16.5,
  /** Half the penalty-box width (40.32 m). */
  boxHalf: 20.16,
  sixYardDepth: 5.5,
  penaltySpot: 11,
} as const

/** Thirds of the pitch along the attacking axis. */
export type Third = 'defensive' | 'middle' | 'final'

export function thirdOf(x: number): Third {
  return x < 1 / 3 ? 'defensive' : x < 2 / 3 ? 'middle' : 'final'
}

export type Lane = 'left' | 'centre' | 'right'

export function laneOf(y: number): Lane {
  return y < 0.3 ? 'left' : y > 0.7 ? 'right' : 'centre'
}

/** Attacking-frame x of the far penalty-box line and the six-yard line. */
export const BOX_X = 1 - PITCH_M.boxDepth / PITCH_M.length
export const SIX_YARD_X = 1 - PITCH_M.sixYardDepth / PITCH_M.length
export const BOX_HALF_Y = PITCH_M.boxHalf / PITCH_M.width
export const PENALTY_SPOT: PitchPoint = { x: 1 - PITCH_M.penaltySpot / PITCH_M.length, y: 0.5 }

/** Inside the penalty area being attacked. */
export function inBox(p: PitchPoint): boolean {
  return p.x >= BOX_X && Math.abs(p.y - 0.5) <= BOX_HALF_Y
}

/** Distance in metres from a point to the centre of the goal being attacked. */
export function distanceToGoal(p: PitchPoint): number {
  const dx = (1 - p.x) * PITCH_M.length
  const dy = (p.y - 0.5) * PITCH_M.width
  return Math.sqrt(dx * dx + dy * dy)
}

/** The angle (radians) the goal mouth subtends from a point: the shooter's view of the target. */
export function goalAngle(p: PitchPoint): number {
  const dx = Math.max((1 - p.x) * PITCH_M.length, 0.3)
  const dy = Math.abs(p.y - 0.5) * PITCH_M.width
  return Math.atan((dy + PITCH_M.goalHalf) / dx) - Math.atan((dy - PITCH_M.goalHalf) / dx)
}

/**
 * Location-only expected goals: a logistic model on distance and the visible
 * goal angle, the shape every public xG model shares. A shot from the
 * penalty spot is ~0.25, from the six-yard line ~0.5, from 25 m ~0.05.
 * Shooter, keeper and situation adjustments are applied by the engine.
 */
export function locationXg(p: PitchPoint): number {
  const logit = -1.2 - 0.085 * distanceToGoal(p) + 1.6 * goalAngle(p)
  return 1 / (1 + Math.exp(-logit))
}

/** Mirror a point into the OTHER side's attacking frame (their goal is our own). */
export function mirror(p: PitchPoint): PitchPoint {
  return { x: 1 - p.x, y: 1 - p.y }
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** A dead-ball spot for the corner an attack won (the nearer flag). */
export function cornerSpot(y: number): PitchPoint {
  return { x: 1, y: y < 0.5 ? 0 : 1 }
}
