import type { PlayedMatch } from '../data/matches'
import type { SimOptions } from '../engine/types'

/** The options every simulation of a bracket match runs with. */
export function matchSimOptions(match: PlayedMatch): SimOptions {
  return { knockout: true, homePossession: match.real.possession.home / 100 }
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
