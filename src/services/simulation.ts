import { buildRealSheet, type PlayedMatch } from '../data/matches'
import { runMonteCarlo } from '../engine/monteCarlo'
import { simulateMatch } from '../engine/simulate'
import type { MonteCarloResult, SimOptions, SimResult, TeamSheet } from '../engine/types'

export interface SimulationOutcome {
  sim: SimResult
  monteCarlo: MonteCarloResult
}

export const MONTE_CARLO_RUNS = 1000

/**
 * Fixed base seed for every insight Monte Carlo. The single-match story stays
 * random, but the win% is a signal and must be reproducible: the same lineups
 * always replay the same 1,000 nights. Baseline (real XI) and edited runs
 * share this seed sequence too, so their delta reflects the lineups alone,
 * not sampling noise.
 */
export const INSIGHT_SEED = 20260719

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

/** The options every simulation of a bracket match runs with. */
export function matchSimOptions(match: PlayedMatch): SimOptions {
  return { knockout: true, homePossession: match.real.possession.home / 100 }
}

const baselineCache = new Map<string, MonteCarloResult>()

/**
 * Monte Carlo for the REAL starting XIs — the baseline an edited lineup's
 * win% is compared against. Fixed-seeded and memoized per match id: it never
 * changes for a given match, however often the user tweaks slots.
 */
export function baselineMonteCarlo(match: PlayedMatch): MonteCarloResult {
  const cached = baselineCache.get(match.id)
  if (cached) return cached
  const result = runMonteCarlo(
    buildRealSheet(match.home),
    buildRealSheet(match.away),
    MONTE_CARLO_RUNS,
    INSIGHT_SEED,
    matchSimOptions(match),
  )
  baselineCache.set(match.id, result)
  return result
}

/**
 * Async boundary around the pure engine. Everything runs client-side today;
 * to move simulation to a server, replace this body with a fetch() — the UI
 * only ever sees the Promise.
 *
 * The seed drives the single-match story only (random by default, so "Run it
 * again" tells a new one). The Monte Carlo always runs from INSIGHT_SEED.
 */
export async function runSimulation(
  home: TeamSheet,
  away: TeamSheet,
  options: SimOptions = {},
  seed: number = randomSeed(),
): Promise<SimulationOutcome> {
  // Yield once so the pressed button can render its loading state.
  await new Promise((resolve) => setTimeout(resolve, 0))
  const sim = simulateMatch(home, away, seed, options)
  const monteCarlo = runMonteCarlo(home, away, MONTE_CARLO_RUNS, INSIGHT_SEED, options)
  return { sim, monteCarlo }
}
