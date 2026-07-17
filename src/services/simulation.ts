import { buildRealSheet, type PlayedMatch } from '../data/matches'
import { runMonteCarlo, runSecondHalfMonteCarlo } from '../engine/monteCarlo'
import { playFirstHalf, resumeMatch, simulateMatch, type HalftimeState } from '../engine/simulate'
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

export interface KickoffOutcome {
  /** The live match, frozen at 45'. Feed to resumeSecondHalf exactly once. */
  firstHalf: HalftimeState
  monteCarlo: MonteCarloResult
}

/**
 * Kick off an interactive match: play minutes 1–45 and freeze at the break,
 * alongside the same insight Monte Carlo runSimulation produces. The second
 * half is played by resumeSecondHalf once the user has made (or declined)
 * half-time changes.
 */
export async function runFirstHalf(
  home: TeamSheet,
  away: TeamSheet,
  options: SimOptions = {},
  seed: number = randomSeed(),
): Promise<KickoffOutcome> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return {
    firstHalf: playFirstHalf(home, away, seed, options),
    monteCarlo: runMonteCarlo(home, away, MONTE_CARLO_RUNS, INSIGHT_SEED, options),
  }
}

/** Async boundary around resumeMatch — same contract as runSimulation's. */
export async function resumeSecondHalf(
  firstHalf: HalftimeState,
  home: TeamSheet,
  away: TeamSheet,
): Promise<SimResult> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return resumeMatch(firstHalf, home, away)
}

export interface HalftimeInsightRuns {
  /** The frozen match played out with the XIs that finished the first half. */
  unchanged: MonteCarloResult
  /** The same seeded second halves with the user's candidate sheets. */
  edited: MonteCarloResult
}

/** The unchanged-XI run never varies for a given pause — computed once per match. */
const halftimeBaselines = new WeakMap<HalftimeState, MonteCarloResult>()

/**
 * The half-time counterpart of the insight Monte Carlo: replay only the
 * second half from the frozen state, once as-is and once with the edited
 * sheets, from the same INSIGHT_SEED sequence — so the win% delta reflects
 * the half-time change alone, not sampling noise.
 */
export async function runHalftimeInsight(
  firstHalf: HalftimeState,
  editedHome: TeamSheet,
  editedAway: TeamSheet,
): Promise<HalftimeInsightRuns> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  let unchanged = halftimeBaselines.get(firstHalf)
  if (!unchanged) {
    unchanged = runSecondHalfMonteCarlo(
      firstHalf,
      firstHalf.home.sheet,
      firstHalf.away.sheet,
      MONTE_CARLO_RUNS,
      INSIGHT_SEED,
    )
    halftimeBaselines.set(firstHalf, unchanged)
  }
  const edited = runSecondHalfMonteCarlo(firstHalf, editedHome, editedAway, MONTE_CARLO_RUNS, INSIGHT_SEED)
  return { unchanged, edited }
}
