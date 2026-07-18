import { describe, expect, it } from 'vitest'
import type { MatchEvent, MomentumTimelinePoint } from '../../engine/types'
import { buildPitchModel, homeDir, momentumInterp, sampleField } from './terrainModel'

const score = { home: 0, away: 0 }
function ev(partial: Partial<MatchEvent> & Pick<MatchEvent, 'minute' | 'type'>): MatchEvent {
  return { score, commentary: '', ...partial }
}

const momentum: MomentumTimelinePoint[] = Array.from({ length: 91 }, (_, m) => ({
  minute: m,
  value: Math.round(60 * Math.sin(m / 8)),
}))

const events: MatchEvent[] = [
  ev({ minute: 20, type: 'shot-saved', side: 'away', xg: 0.25 }), // H1 → away attacks −X
  ev({ minute: 30, type: 'goal', side: 'home', xg: 0.4, player: { id: 'p1', name: 'Striker', shirtNumber: 9, ratings: {} as never } }), // H1 → home +X
  ev({ minute: 60, type: 'shot-saved', side: 'home', xg: 0.3 }), // H2 → home attacks −X (switched)
  ev({ minute: 70, type: 'red-card', side: 'home', player: { id: 'p2', name: 'Defender', shirtNumber: 4, ratings: {} as never } }),
]

describe('homeDir', () => {
  it('flips at each period boundary', () => {
    expect(homeDir(10)).toBe(1) // first half
    expect(homeDir(60)).toBe(-1) // second half
    expect(homeDir(100)).toBe(1) // ET first half
    expect(homeDir(115)).toBe(-1) // ET second half
  })
})

describe('buildPitchModel', () => {
  const model = buildPitchModel(momentum, events, '#5aa9ff', '#2fbf71')

  it('places shots in the shooting side attacking third, switching ends at half', () => {
    expect(model.bumps).toHaveLength(3)
    const homeH1 = model.bumps.find((b) => b.side === 'home' && b.minute === 30)!
    const awayH1 = model.bumps.find((b) => b.side === 'away' && b.minute === 20)!
    const homeH2 = model.bumps.find((b) => b.side === 'home' && b.minute === 60)!
    expect(homeH1.x).toBeGreaterThan(0) // home attacks +X in H1
    expect(awayH1.x).toBeLessThan(0) // away attacks −X in H1
    expect(homeH2.x).toBeLessThan(0) // home switched to −X in H2
  })

  it('is deterministic — same events give the same spots', () => {
    const again = buildPitchModel(momentum, events, '#5aa9ff', '#2fbf71')
    expect(again.bumps[0].x).toBe(model.bumps[0].x)
    expect(again.bumps[0].z).toBe(model.bumps[0].z)
  })

  it('emits pins for goals and red cards', () => {
    expect(model.pins).toHaveLength(2)
    const goal = model.pins.find((p) => p.kind === 'goal')!
    const red = model.pins.find((p) => p.kind === 'red')!
    expect(goal.minute).toBe(30)
    expect(goal.side).toBe('home')
    expect(red.color).toBe('#e5484d')
  })
})

describe('sampleField', () => {
  const model = buildPitchModel(momentum, events, '#5aa9ff', '#2fbf71')
  const goalBump = model.bumps.find((b) => b.isGoal)!

  it('stabs a sharp peak in the shooter colour once a shot is revealed', () => {
    const before = sampleField(model.bumps, goalBump.x, goalBump.z, 10, 0) // just the base sheets
    const after = sampleField(model.bumps, goalBump.x, goalBump.z, 40, 0) // goal revealed
    expect(after.height).toBeGreaterThan(before.height + 2) // sharp peak
    expect(after.mix).toBeGreaterThan(0.7) // home goal → home colour overrides territory
  })

  it('keeps both teams present with a base sheet everywhere', () => {
    // Even a quiet, shot-less point has body (both sheets always lie over the pitch).
    const quiet = sampleField([], -4, 3, 5, 0)
    expect(quiet.height).toBeGreaterThan(0.2)
  })

  it('floods more territory for the pressing side', () => {
    // A point just into away's half (+X). Home pressing should claim it.
    const homeLeads = sampleField([], 4, 0, 20, 0.8)
    const awayLeads = sampleField([], 4, 0, 20, -0.8)
    expect(homeLeads.mix).toBeGreaterThan(0.7) // home holds ground past centre
    expect(awayLeads.mix).toBeLessThan(0.3) // away has pushed home back
  })

  it('switches which end each side holds at half-time', () => {
    // With home pressing, away is squeezed into a corner that flips at the break.
    const h1 = sampleField([], 10, 0, 20, 0.8) // H1: far +X is away's squeezed corner
    const h2 = sampleField([], 10, 0, 60, 0.8) // H2: ends swapped, +X is now home's
    expect(h1.mix).toBeLessThan(0.3)
    expect(h2.mix).toBeGreaterThan(0.7)
  })
})

describe('momentumInterp', () => {
  it('interpolates between per-minute samples', () => {
    const pm = [
      { minute: 0, momentum: 0 },
      { minute: 1, momentum: 100 },
    ]
    expect(momentumInterp(pm, 0.5)).toBeCloseTo(50, 5)
    expect(momentumInterp(pm, 0)).toBe(0)
  })
})
