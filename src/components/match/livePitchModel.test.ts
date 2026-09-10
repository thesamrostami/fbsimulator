import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../../data/matches'
import { simulateMatch } from '../../engine/simulate'
import { isShotEvent, type RosterEntry } from '../../engine/types'
import {
  ballAt,
  ballFrameOf,
  liveLine,
  playerTargets,
  rosterAt,
  shotOutcomes,
  shotTarget,
  sideTargets,
  toWorld,
} from './livePitchModel'
import { PITCH } from './terrainModel'

const match = MATCHES['r16-4'] as PlayedMatch
const sim = simulateMatch(buildRealSheet(match.home), buildRealSheet(match.away), 21, {
  knockout: true,
  homePossession: match.real.possession.home / 100,
})

describe('toWorld', () => {
  it('sends each side toward its own goal end and swaps ends at half-time', () => {
    const homeGoal1 = toWorld({ x: 1, y: 0.5 }, 'home', 10)
    const awayGoal1 = toWorld({ x: 1, y: 0.5 }, 'away', 10)
    expect(homeGoal1.x).toBeCloseTo(PITCH.len / 2)
    expect(awayGoal1.x).toBeCloseTo(-PITCH.len / 2)
    expect(toWorld({ x: 1, y: 0.5 }, 'home', 60).x).toBeCloseTo(-PITCH.len / 2)
    // A point and its mirror in the other frame are the same spot on the ground.
    const p = { x: 0.8, y: 0.3 }
    const mirrored = { x: 0.2, y: 0.7 }
    expect(toWorld(p, 'home', 30).x).toBeCloseTo(toWorld(mirrored, 'away', 30).x, 9)
    expect(toWorld(p, 'home', 30).z).toBeCloseTo(toWorld(mirrored, 'away', 30).z, 9)
  })
})

describe('rosterAt', () => {
  it('uses the kick-off XIs before the break, the restart XIs after, minus anyone sent off', () => {
    const first = rosterAt(sim.lineupLog, sim.events, 10)
    expect(first.home).toHaveLength(11)
    expect(first.away).toHaveLength(11)
    const red = sim.events.find((e) => e.type === 'red-card')
    if (red) {
      const after = rosterAt(sim.lineupLog, sim.events, red.minute + 1)
      const side = red.side === 'home' ? after.home : after.away
      expect(side.some((p) => p.playerId === red.player!.id)).toBe(false)
      expect(side).toHaveLength(10)
    }
    // At 45.0 (the whistle) the first-half XIs still stand.
    expect(rosterAt(sim.lineupLog, sim.events, 45).home.map((p) => p.playerId)).toEqual(
      sim.lineupLog[0].home.map((p) => p.playerId),
    )
  })
})

describe('ballAt', () => {
  const outcomes = shotOutcomes(sim.events)

  it('stays on the pitch and moves continuously inside a possession', () => {
    for (let t = 0; t <= 90; t += 0.05) {
      const b = ballAt(sim.sequences, outcomes, t)
      expect(Math.abs(b.world.x)).toBeLessThanOrEqual(PITCH.len / 2 + 1.5)
      expect(Math.abs(b.world.z)).toBeLessThanOrEqual(PITCH.wid / 2 + 0.5)
      expect(b.y).toBeGreaterThanOrEqual(0)
    }
    // Within one pass the ball never jumps more than a few metres per tick.
    const seq = sim.sequences.find((s) => s.points.length >= 3)!
    const a = seq.points[0]
    const c = seq.points[1]
    let prev = ballAt(sim.sequences, outcomes, a.t)
    for (let t = a.t; t <= c.t; t += (c.t - a.t) / 20) {
      const b = ballAt(sim.sequences, outcomes, t)
      expect(Math.hypot(b.world.x - prev.world.x, b.world.z - prev.world.z)).toBeLessThan(PITCH.len / 4)
      prev = b
    }
  })

  it('lands each possession where the engine put its touches', () => {
    for (const seq of sim.sequences.slice(0, 40)) {
      for (const p of seq.points) {
        const b = ballAt(sim.sequences, outcomes, p.t)
        const expected = toWorld({ x: p.x, y: p.y }, seq.side, seq.minute)
        expect(b.world.x).toBeCloseTo(expected.x, 1)
        expect(b.world.z).toBeCloseTo(expected.z, 1)
      }
    }
  })

  it('flies a goal into the net and a miss wide of it', () => {
    const goal = sim.events.find((e) => e.type === 'goal' && e.sequence !== undefined)!
    const seq = sim.sequences[goal.sequence!]
    const end = ballAt(sim.sequences, outcomes, seq.t1 - 1e-6)
    const net = toWorld({ x: 1.01, y: 0.5 }, goal.side!, goal.minute)
    expect(Math.abs(end.world.x - net.x)).toBeLessThan(0.6)
    expect(Math.abs(end.world.z - net.z)).toBeLessThan(1.2)
    expect(shotTarget({ x: 0.9, y: 0.5 }, 'miss').x).toBeGreaterThan(1)
    expect(Math.abs(shotTarget({ x: 0.9, y: 0.5 }, 'miss').y - 0.5)).toBeGreaterThan(0.06)
    expect(shotTarget({ x: 0.9, y: 0.5 }, 'blocked').x).toBeLessThan(0.95)
  })

  it('recovers the attacking-frame point of the ball for its owner', () => {
    for (const t of [3.2, 17.7, 44.9, 61.4, 88.3]) {
      const b = ballAt(sim.sequences, outcomes, t)
      const frame = ballFrameOf(b, t)
      const back = toWorld(frame, b.side, t)
      expect(back.x).toBeCloseTo(b.world.x, 6)
      expect(back.z).toBeCloseTo(b.world.z, 6)
    }
  })
})

describe('sideTargets', () => {
  const roster: RosterEntry[] = sim.lineupLog[0].home
  const gk = roster.find((p) => p.line === 'GK')!
  const striker = roster.find((p) => p.line === 'FWD')!

  it('puts the carrier on the ball, the keeper near his goal, everyone on the pitch', () => {
    const ball = { x: 0.72, y: 0.4 }
    const targets = sideTargets(roster, ball, true, striker.playerId)
    expect(targets.get(striker.playerId)).toEqual(ball)
    expect(targets.get(gk.playerId)!.x).toBeLessThan(0.08)
    for (const [, p] of targets) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
  })

  it('pushes the block up in possession and drops it when defending', () => {
    const cb = roster.find((p) => p.line === 'DEF')!
    const high = sideTargets(roster, { x: 0.8, y: 0.5 }, true, undefined).get(cb.playerId)!
    const deep = sideTargets(roster, { x: 0.2, y: 0.5 }, false, undefined).get(cb.playerId)!
    expect(high.x).toBeGreaterThan(deep.x)
  })

  it('gives every player on both sides a world target', () => {
    const outcomes = shotOutcomes(sim.events)
    const roster2 = rosterAt(sim.lineupLog, sim.events, 30)
    const ball = ballAt(sim.sequences, outcomes, 30.4)
    const targets = playerTargets(roster2, ball, 30.4, ballFrameOf(ball, 30.4))
    expect(targets).toHaveLength(roster2.home.length + roster2.away.length)
    for (const t of targets) {
      expect(Math.abs(t.world.x)).toBeLessThanOrEqual(PITCH.len / 2)
      expect(Math.abs(t.world.z)).toBeLessThanOrEqual(PITCH.wid / 2)
    }
  })
})

describe('liveLine', () => {
  it('counts a player’s shots, goals and assists up to the playhead and matches the final stats at full time', () => {
    const scorer = sim.events.find((e) => e.type === 'goal')!.player!
    const before = liveLine(scorer.id, sim.events, sim.sequences, 0)
    expect(before.shots).toBe(0)
    const full = liveLine(scorer.id, sim.events, sim.sequences, 120)
    const stats = sim.playerStats[scorer.id]
    expect(full.shots).toBe(stats.shots)
    expect(full.goals).toBe(stats.goals)
    expect(full.assists).toBe(stats.assists)
    expect(full.xg).toBeCloseTo(stats.xg, 1)
    // Every shot event can be traced back through the line.
    const allShots = sim.events.filter((e) => isShotEvent(e)).length
    const summed = Object.keys(sim.playerStats).reduce((n, id) => n + liveLine(id, sim.events, sim.sequences, 120).shots, 0)
    expect(summed).toBe(allShots)
  })
})
