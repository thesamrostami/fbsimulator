import { describe, expect, it } from 'vitest'
import calibration from '../data/generated/calibration.json'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { EMPIRICAL_ON_TARGET_GIVEN_MISS, goalMinuteFactor, SHOOTOUT_BASE_CONVERSION } from './empirical'
import { runMonteCarlo } from './monteCarlo'

describe('empirical calibration (calibration.json)', () => {
  it('goal-minute shares sum to 1 in each phase', () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(calibration.goalMinutes.regulationShare)).toBeCloseTo(1, 2)
    expect(sum(calibration.goalMinutes.extraTimeShare)).toBeCloseTo(1, 2)
    expect(calibration.goalMinutes.regulationShare).toHaveLength(18)
    expect(calibration.goalMinutes.extraTimeShare).toHaveLength(6)
  })

  it('minute factors have mean 1 per phase and rise late in halves', () => {
    let regMean = 0
    for (let m = 1; m <= 90; m += 1) regMean += goalMinuteFactor(m)
    expect(regMean / 90).toBeCloseTo(1, 2)
    let etMean = 0
    for (let m = 91; m <= 120; m += 1) etMean += goalMinuteFactor(m)
    expect(etMean / 30).toBeCloseTo(1, 2)
    // Football scores more at the ends of halves than at their starts.
    expect(goalMinuteFactor(88)).toBeGreaterThan(goalMinuteFactor(3))
    expect(goalMinuteFactor(44)).toBeGreaterThan(goalMinuteFactor(3))
  })

  it('conversion constants come from the StatsBomb sample and stay in football ranges', () => {
    expect(calibration.conversion?.sample.shots).toBeGreaterThan(300)
    expect(calibration.conversion?.shotsToGoals).toBeGreaterThan(0.07)
    expect(calibration.conversion?.shotsToGoals).toBeLessThan(0.16)
    expect(EMPIRICAL_ON_TARGET_GIVEN_MISS).toBeGreaterThan(0.15)
    expect(EMPIRICAL_ON_TARGET_GIVEN_MISS).toBeLessThan(0.45)
    expect(SHOOTOUT_BASE_CONVERSION).toBeGreaterThanOrEqual(0.7)
    expect(SHOOTOUT_BASE_CONVERSION).toBeLessThanOrEqual(0.8)
  })

  it('simulated volumes look like real World Cup football', () => {
    const match = MATCHES['r16-5'] as PlayedMatch // POR-ESP: two even, strong sides
    const mc = runMonteCarlo(buildRealSheet(match.home), buildRealSheet(match.away), 300, 42, {
      knockout: true,
      homePossession: match.real.possession.home / 100,
    })
    const goalsPerTeam = (mc.avgGoals.home + mc.avgGoals.away) / 2
    expect(goalsPerTeam).toBeGreaterThan(0.7)
    expect(goalsPerTeam).toBeLessThan(2.2)
  })
})
