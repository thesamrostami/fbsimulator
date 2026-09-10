import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { runMonteCarlo } from '../engine/monteCarlo'
import { buildSheet, initialMatchState, matchAppReducer } from '../state/appState'
import {
  baselineMonteCarlo,
  INSIGHT_SEED,
  matchSimOptions,
  MONTE_CARLO_RUNS,
  runSimulation,
} from './simulation'

const match = MATCHES['r16-4'] as PlayedMatch

/** The same edit whyThisResult's tests use: bench Kane (slot f2) for seat 0. */
function editedLineups() {
  return matchAppReducer(initialMatchState(match), {
    type: 'swap',
    side: 'away',
    a: { kind: 'slot', slotId: 'f2' },
    b: { kind: 'bench', index: 0 },
  }).lineups
}

describe('insight seeding', () => {
  it('reproduces the same win% for the same match and edited lineup across calls', async () => {
    const lineups = editedLineups()
    const home = buildSheet(match.home, lineups.home)
    const away = buildSheet(match.away, lineups.away)

    // Both calls take the default (random) story seed: the stories may differ,
    // but the insight Monte Carlo must not — no randomSeed() in that path.
    const first = await runSimulation(home, away, matchSimOptions(match))
    const second = await runSimulation(home, away, matchSimOptions(match))
    expect(second.monteCarlo).toEqual(first.monteCarlo)
    expect(first.monteCarlo.baseSeed).toBe(INSIGHT_SEED)
    // Two full 1,000-replay insight runs on the possession engine.
  }, 30000)

  it('memoizes the baseline per match id and pins it to the fixed seed', () => {
    const baseline = baselineMonteCarlo(match)
    expect(baselineMonteCarlo(match)).toBe(baseline)

    const direct = runMonteCarlo(
      buildRealSheet(match.home),
      buildRealSheet(match.away),
      MONTE_CARLO_RUNS,
      INSIGHT_SEED,
      matchSimOptions(match),
    )
    expect(baseline).toEqual(direct)
  })

  it('keeps the baseline calibrated: the real winner wins a plausible share', () => {
    // England won r16-4 on the night and are the stronger squad; the same
    // plausibility bar the calibration suite holds ratings to.
    const baseline = baselineMonteCarlo(match)
    expect(baseline.awayWinPct).toBeGreaterThanOrEqual(30)
    expect(baseline.awayWinPct).toBeGreaterThan(baseline.homeWinPct)
  })

  it('matches the baseline when the "edited" lineup is actually the real XI', () => {
    const { lineups } = initialMatchState(match)
    const mc = runMonteCarlo(
      buildSheet(match.home, lineups.home),
      buildSheet(match.away, lineups.away),
      MONTE_CARLO_RUNS,
      INSIGHT_SEED,
      matchSimOptions(match),
    )
    expect(mc).toEqual(baselineMonteCarlo(match))
  })
})
