import { isShotEvent, type MatchEvent, type MomentumTimelinePoint } from '../../engine/types'

/**
 * Builds the data for the 3D pitch-terrain: a football ground over which each
 * team's attacking threat rises as coloured terrain, massing in the third it is
 * attacking (home attacks +X, away attacks −X). No three.js here so it stays
 * unit-testable.
 *
 * Shots and penalties carry the engine's real pitch spot (event.spot, in the
 * acting side's attacking frame); the terrain rises exactly there. Events
 * without a spot (older data) fall back to a deterministic pseudo-position in
 * the attacking third so the view never breaks.
 */
export const PITCH = {
  /** World length, goal to goal (X). */
  len: 26,
  /** World width, touchline to touchline (Z). */
  wid: 17,
  /** Terrain grid segments. */
  gridX: 66,
  gridZ: 42,
  /** Terrain base height, just above the pitch surface. */
  y0: 0.02,
  /** Minutes a hill takes to rise once its event is crossed. */
  growMin: 2.4,
  /** World height per unit of xG. */
  heightScale: 5.6,
  /** A goal counts as this much extra xG for height. */
  goalXgBoost: 0.7,
  /** Hill spread — tight, so a chance stabs a sharp peak rather than a blob. */
  bumpSigmaX: 1.5,
  bumpSigmaZ: 1.1,
  /** Body height of each team's territory sheet (both are always present). */
  baseHeight: 0.28,
  /** Raised wave riding the contested territory line — the visible "push". */
  boundaryAmp: 1.4,
  boundarySigma: 2.6,
  /** How far the territory line slides from centre (fraction of half-length). */
  boundaryMaxShift: 0.6,
  /** Smoothstep half-width of the colour seam at the boundary. */
  colorBlend: 1.7,
  /** Shot-hill height above which the shooter's colour overrides territory. */
  hillThresh: 0.7,
} as const

export interface Bump {
  x: number
  z: number
  height: number
  minute: number
  side: 'home' | 'away'
  isGoal: boolean
}

export interface TerrainPin {
  minute: number
  kind: 'goal' | 'red'
  side: 'home' | 'away'
  detail: string
  color: string
  x: number
  z: number
}

export interface PerMinute {
  minute: number
  momentum: number
}

export interface PitchModel {
  pitch: { len: number; wid: number }
  bumps: Bump[]
  pins: TerrainPin[]
  perMinute: PerMinute[]
}

function strHash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Which way home attacks at a given minute (+1 = toward +X). Teams change ends
 * at half-time (and each extra-time break), so the direction flips every period.
 */
export function homeDir(minute: number): 1 | -1 {
  const period = minute <= 45 ? 0 : minute <= 90 ? 1 : minute <= 105 ? 2 : 3
  return period % 2 === 0 ? 1 : -1
}

/** The engine's recorded spot (attacking frame, 0-1) in world space; ends swap each period. */
export function worldSpot(spot: { x: number; y: number }, side: 'home' | 'away', minute: number): { x: number; z: number } {
  const dir = (side === 'home' ? 1 : -1) * homeDir(minute)
  return { x: (spot.x - 0.5) * PITCH.len * dir, z: (spot.y - 0.5) * PITCH.wid * dir }
}

/** Fallback pitch spot for an event without one, biased to that side's attacking third. */
function eventSpot(minute: number, playerId: string | undefined, side: 'home' | 'away', ownHalf = false): { x: number; z: number } {
  const rng = mulberry32(strHash(`${minute}-${playerId ?? 'x'}-${ownHalf ? 'd' : 'a'}`))
  const u1 = rng()
  const u2 = rng()
  // Attack direction flips at half-time; own-half events sit behind that.
  const attackDir = (side === 'home' ? 1 : -1) * homeDir(minute)
  const along = ownHalf ? -(0.1 + 0.35 * u1) : 0.14 + 0.82 * Math.pow(u1, 0.7)
  return { x: attackDir * (PITCH.len / 2) * along, z: (u2 - 0.5) * PITCH.wid * 0.78 }
}

export function buildPitchModel(
  momentumTimeline: MomentumTimelinePoint[],
  events: MatchEvent[],
  homeColor: string,
  awayColor: string,
): PitchModel {
  const shots = events.filter((e) => e.side && typeof e.xg === 'number' && isShotEvent(e))
  const bumps: Bump[] = shots.map((e) => {
    const side = e.side as 'home' | 'away'
    const isGoal = e.type === 'goal'
    const spot = e.spot ? worldSpot(e.spot, side, e.minute) : eventSpot(e.minute, e.player?.id, side)
    return {
      ...spot,
      height: ((e.xg as number) + (isGoal ? PITCH.goalXgBoost : 0)) * PITCH.heightScale,
      minute: e.minute,
      side,
      isGoal,
    }
  })

  const pins: TerrainPin[] = events
    .filter((e) => (e.type === 'goal' || e.type === 'red-card') && e.side)
    .map((e) => {
      const side = e.side as 'home' | 'away'
      const isGoal = e.type === 'goal'
      const spot = e.spot ? worldSpot(e.spot, side, e.minute) : eventSpot(e.minute, e.player?.id, side, !isGoal)
      return {
        minute: e.minute,
        kind: isGoal ? ('goal' as const) : ('red' as const),
        side,
        detail: `${e.player?.name ?? ''} ${e.minute}'`.trim(),
        color: isGoal ? (side === 'home' ? homeColor : awayColor) : '#e5484d',
        x: spot.x,
        z: spot.z,
      }
    })

  const momRaw = new Map<number, number>()
  for (const p of momentumTimeline) momRaw.set(p.minute, p.value)
  const last = momentumTimeline[momentumTimeline.length - 1]?.minute ?? 0
  const perMinute: PerMinute[] = []
  for (let m = 0; m <= last; m++) perMinute.push({ minute: m, momentum: momRaw.get(m) ?? 0 })

  return { pitch: { len: PITCH.len, wid: PITCH.wid }, bumps, pins, perMinute }
}

/** Linear-interpolated momentum (home tilt, -100..100) at a fractional minute. */
export function momentumInterp(perMinute: PerMinute[], minute: number): number {
  if (perMinute.length === 0) return 0
  const i = Math.max(0, Math.min(perMinute.length - 2, Math.floor(minute)))
  const a = perMinute[i]
  const b = perMinute[i + 1] ?? a
  const f = b.minute > a.minute ? (minute - a.minute) / (b.minute - a.minute) : 0
  return a.momentum + (b.momentum - a.momentum) * f
}

export interface FieldSample {
  /** World height of the surface above the pitch. */
  height: number
  /** Colour mix, 0 = away colour, 1 = home colour. */
  mix: number
}

/**
 * The territory surface at a pitch point (x,z) at the given minute — the two
 * teams pushing against each other. The whole pitch is split by a boundary line
 * that slides with momentum (home holds the ground behind it, away ahead of
 * it), a raised wave rides that contested line (the visible push), and each
 * revealed shot stabs a sharp peak in the shooter's colour. Ends swap at
 * half-time. Returns the height and a home↔away colour mix for the caller.
 */
export function sampleField(
  bumps: Bump[],
  x: number,
  z: number,
  minute: number,
  mom01: number,
  growMin: number = PITCH.growMin,
): FieldSample {
  let homeHill = 0
  let awayHill = 0
  const sx2 = 2 * PITCH.bumpSigmaX * PITCH.bumpSigmaX
  const sz2 = 2 * PITCH.bumpSigmaZ * PITCH.bumpSigmaZ
  for (const b of bumps) {
    const grow = Math.min(1, Math.max(0, (minute - b.minute) / growMin))
    if (grow <= 0) continue
    const dx = x - b.x
    // A sharp hill fades within ~4σ; skip far bumps (its Gaussian there is ~0).
    if (dx > 6 || dx < -6) continue
    const dz = z - b.z
    if (dz > 4.5 || dz < -4.5) continue
    const g = grow * b.height * Math.exp(-(dx * dx) / sx2 - (dz * dz) / sz2)
    if (b.side === 'home') homeHill += g
    else awayHill += g
  }

  // Territory: s is the attack coordinate (home's goal at −half, away's at
  // +half). The boundary rides at s = sb, sliding toward the goal of whoever is
  // pressing. Home holds s < sb, away holds s > sb; ends swap at half.
  const da = homeDir(minute)
  const s = x * da
  const sb = mom01 * (PITCH.len / 2) * PITCH.boundaryMaxShift
  const territoryMix = 1 - smoothstep(sb - PITCH.colorBlend, sb + PITCH.colorBlend, s)
  const ds = s - sb
  const ridge = PITCH.boundaryAmp * Math.exp(-(ds * ds) / (2 * PITCH.boundarySigma * PITCH.boundarySigma))

  const height = PITCH.baseHeight + ridge + homeHill + awayHill
  const hillTotal = homeHill + awayHill
  const hillProm = smoothstep(0, PITCH.hillThresh, hillTotal)
  const hillMix = hillTotal > 1e-6 ? homeHill / hillTotal : 0.5
  const mix = territoryMix * (1 - hillProm) + hillMix * hillProm
  return { height, mix }
}
