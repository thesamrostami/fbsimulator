import { describe, expect, it } from 'vitest'
import {
  BOX_X,
  distanceToGoal,
  goalAngle,
  inBox,
  laneOf,
  locationXg,
  mirror,
  PENALTY_SPOT,
  SIX_YARD_X,
  thirdOf,
} from './pitch'
import { tacticalProfile } from './tactics'
import { buildZoneProfile, zoneIndex } from './state'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'

describe('pitch geometry', () => {
  it('measures the attacking frame in real metres', () => {
    expect(distanceToGoal({ x: 1, y: 0.5 })).toBe(0)
    expect(distanceToGoal(PENALTY_SPOT)).toBeCloseTo(11, 5)
    expect(distanceToGoal({ x: 0.5, y: 0.5 })).toBeCloseTo(52.5, 5)
    expect(inBox(PENALTY_SPOT)).toBe(true)
    expect(inBox({ x: BOX_X - 0.01, y: 0.5 })).toBe(false)
    expect(inBox({ x: 0.95, y: 0.1 })).toBe(false)
    expect(SIX_YARD_X).toBeGreaterThan(BOX_X)
  })

  it('splits the pitch into thirds and lanes, mirrored for the other side', () => {
    expect(thirdOf(0.1)).toBe('defensive')
    expect(thirdOf(0.5)).toBe('middle')
    expect(thirdOf(0.9)).toBe('final')
    expect(laneOf(0.1)).toBe('left')
    expect(laneOf(0.5)).toBe('centre')
    expect(laneOf(0.9)).toBe('right')
    expect(mirror({ x: 0.9, y: 0.1 }).x).toBeCloseTo(0.1, 9)
    expect(mirror({ x: 0.9, y: 0.1 }).y).toBeCloseTo(0.9, 9)
    // The mirror of a zone is its opposite corner of the 3×3 grid.
    for (const p of [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.8 }]) {
      expect(zoneIndex(mirror(p))).toBe(8 - zoneIndex(p))
    }
  })

  it('location xG matches the shape every public model shares', () => {
    const spot = locationXg(PENALTY_SPOT)
    expect(spot).toBeGreaterThan(0.2)
    expect(spot).toBeLessThan(0.32)
    const sixYard = locationXg({ x: SIX_YARD_X, y: 0.5 })
    expect(sixYard).toBeGreaterThan(0.4)
    expect(sixYard).toBeLessThan(0.6)
    const twentyFive = locationXg({ x: 1 - 25 / 105, y: 0.5 })
    expect(twentyFive).toBeGreaterThan(0.03)
    expect(twentyFive).toBeLessThan(0.07)
    // Further out and wider is always worse.
    expect(locationXg({ x: 0.9, y: 0.5 })).toBeGreaterThan(locationXg({ x: 0.8, y: 0.5 }))
    expect(locationXg({ x: 0.9, y: 0.5 })).toBeGreaterThan(locationXg({ x: 0.9, y: 0.25 }))
    expect(goalAngle({ x: 0.9, y: 0.5 })).toBeGreaterThan(goalAngle({ x: 0.9, y: 0.2 }))
  })
})

describe('zone profile', () => {
  const eng = buildRealSheet((MATCHES['r16-4'] as PlayedMatch).away)
  const profile = buildZoneProfile(eng.starters)

  it('puts forwards on the ball in the final third and defenders in the defensive third', () => {
    const line = (weights: Float64Array) => {
      let best = 0
      for (let i = 1; i < weights.length; i++) if (weights[i] > weights[best]) best = i
      return profile.players[best].slot.line
    }
    expect(line(profile.shooter[7])).toBe('FWD') // final third, centre
    expect(line(profile.carrier[1])).toBe('DEF') // defensive third, centre
    // Against an attack on the opponent's final third (our defensive third), the back line defends.
    expect(line(profile.defender[7])).toBe('DEF')
    expect(profile.gkIndex).toBe(0)
    expect(profile.players[profile.penaltyTaker].player.name).toBe('Kane')
  })

  it('rates the group covering each zone on the ratings scale', () => {
    for (let z = 0; z < 9; z++) {
      expect(profile.progress[z]).toBeGreaterThan(50)
      expect(profile.progress[z]).toBeLessThan(99)
      expect(profile.defence[z]).toBeGreaterThan(40)
      expect(profile.defence[z]).toBeLessThan(99)
    }
    // The back line defends its own box better than the forwards defend the far end.
    expect(profile.defence[7]).toBeGreaterThan(profile.defence[1])
  })
})

describe('tactical profile', () => {
  it('is neutral by default and trades off in every non-neutral setting', () => {
    const neutral = tacticalProfile()
    expect(neutral.attackRate).toBe(1)
    expect(neutral.defence).toBe(1)
    expect(neutral.pressRegain).toBe(1)
    expect(neutral.lineShift).toBe(0)
    const attacking = tacticalProfile({ mentality: 'attacking', pressing: 'mid', width: 'normal' })
    expect(attacking.attackRate).toBeGreaterThan(1)
    expect(attacking.defence).toBeLessThan(1)
    expect(attacking.counterAgainst).toBeGreaterThan(1)
    const press = tacticalProfile({ mentality: 'balanced', pressing: 'high', width: 'normal' })
    expect(press.pressRegain).toBeGreaterThan(1)
    expect(press.fouls).toBeGreaterThan(1)
    const wide = tacticalProfile({ mentality: 'balanced', pressing: 'mid', width: 'wide' })
    expect(wide.crossShare).toBeGreaterThan(neutral.crossShare)
    expect(wide.centralConceded).toBeGreaterThan(1)
  })
})
