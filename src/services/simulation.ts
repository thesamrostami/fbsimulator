import { runMonteCarlo } from '../engine/monteCarlo'
import { simulateMatch } from '../engine/simulate'
import type { MonteCarloResult, SimOptions, SimResult, TeamSheet } from '../engine/types'

export interface SimulationOutcome {
  sim: SimResult
  monteCarlo: MonteCarloResult
}

export const MONTE_CARLO_RUNS = 1000

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

/**
 * Async boundary around the pure engine. Everything runs client-side today;
 * to move simulation to a server, replace this body with a fetch() — the UI
 * only ever sees the Promise.
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
  const monteCarlo = runMonteCarlo(home, away, MONTE_CARLO_RUNS, seed, options)
  return { sim, monteCarlo }
}
