import { buildRealSheet, type PlayedMatch } from '../data/matches'
import { runMonteCarlo } from '../engine/monteCarlo'
import { playFirstHalf, resumeMatch, resumeUntil, simulateMatch, type HalftimeState } from '../engine/simulate'
import type { MonteCarloResult, SimOptions, SimResult, TeamSheet } from '../engine/types'
import { buildSheet, realLineupState, type LineupState, type SideKey } from '../state/appState'
import { lineupsAt, type MatchScript } from './matchScript'
import { requestMonteCarlo } from './monteCarloClient'
import { INSIGHT_SEED, matchSimOptions, MONTE_CARLO_RUNS } from './simOptions'

export { INSIGHT_SEED, matchSimOptions, MONTE_CARLO_RUNS } from './simOptions'

/**
 * Async boundary around the pure engine. The single match plays in this
 * thread (it is ~half a millisecond and the UI needs the live handle); the
 * 1,000-replay Monte Carlos go to a Web Worker (see monteCarloClient) so the
 * insight never stalls the page. Everything is deterministic: the story
 * comes from a random seed, every Monte Carlo from INSIGHT_SEED.
 */

export interface SimulationOutcome {
  sim: SimResult
  monteCarlo: MonteCarloResult
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

const baselineCache = new Map<string, MonteCarloResult>()

/**
 * Monte Carlo for the REAL starting XIs — the baseline an edited lineup's
 * win% is compared against. Fixed-seeded and memoized per match id: it never
 * changes for a given match, however often the user tweaks slots.
 * Synchronous (the result page needs it at first paint).
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
 * One full match plus its insight Monte Carlo (still in this thread —
 * kept for callers that want both at once, e.g. tests and restores).
 */
export async function runSimulation(
  home: TeamSheet,
  away: TeamSheet,
  options: SimOptions = {},
  seed: number = randomSeed(),
): Promise<SimulationOutcome> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  const sim = simulateMatch(home, away, seed, options)
  const monteCarlo = runMonteCarlo(home, away, MONTE_CARLO_RUNS, INSIGHT_SEED, options)
  return { sim, monteCarlo }
}

/** The kick-off Monte Carlo for a match's lineups, on the worker. */
export function kickoffMonteCarlo(match: PlayedMatch, lineups: Record<SideKey, LineupState>): Promise<MonteCarloResult> {
  return requestMonteCarlo({ kind: 'full', matchId: match.id, lineups, runs: MONTE_CARLO_RUNS, seed: INSIGHT_SEED })
}

/**
 * Kick off an interactive match: play minutes 1–45 in this thread and
 * freeze at the break. The insight Monte Carlo is NOT awaited — it runs on
 * the worker while the first half plays; MatchPage stores it when it lands.
 */
export function kickOff(match: PlayedMatch, lineups: Record<SideKey, LineupState>, seed: number = randomSeed()): HalftimeState {
  return playFirstHalf(buildSheet(match.home, lineups.home), buildSheet(match.away, lineups.away), seed, matchSimOptions(match))
}

/** Continue a frozen match to the next pause (`until`) or, with null, to the end. */
export function continueMatch(
  match: PlayedMatch,
  live: HalftimeState,
  lineups: Record<SideKey, LineupState>,
  until: number | null,
): HalftimeState | SimResult {
  const home = buildSheet(match.home, lineups.home)
  const away = buildSheet(match.away, lineups.away)
  return until === null ? resumeMatch(live, home, away) : resumeUntil(live, home, away, until)
}

export interface PauseInsightRuns {
  /** The frozen match played out with the XIs on the pitch. */
  unchanged: MonteCarloResult
  /** The same seeded remainders with the candidate lineups. */
  edited: MonteCarloResult
}

const unchangedCache = new Map<string, Promise<MonteCarloResult>>()

/**
 * The pause-time counterpart of the insight Monte Carlo: replay only the
 * remainder from the frozen state, once as-is and once with the edited
 * lineups, from the same INSIGHT_SEED sequence — so the win% delta reflects
 * the change alone. Both run on the worker; the as-is run is cached per
 * script + pause since it never changes while the user taps.
 */
export function pauseInsight(
  match: PlayedMatch,
  script: MatchScript,
  pausedAt: number,
  edited: Record<SideKey, LineupState>,
): Promise<PauseInsightRuns> {
  const key = `${script.matchId}:${script.seed}:${pausedAt}:${JSON.stringify(script.changes)}`
  let unchanged = unchangedCache.get(key)
  if (!unchanged) {
    unchanged = requestMonteCarlo({
      kind: 'remainder',
      matchId: match.id,
      script,
      pausedAt,
      lineups: lineupsAt(script, pausedAt),
      runs: MONTE_CARLO_RUNS,
      seed: INSIGHT_SEED,
    })
    unchangedCache.set(key, unchanged)
  }
  const editedRun = requestMonteCarlo({
    kind: 'remainder',
    matchId: match.id,
    script,
    pausedAt,
    lineups: edited,
    runs: MONTE_CARLO_RUNS,
    seed: INSIGHT_SEED,
  })
  return Promise.all([unchanged, editedRun]).then(([u, e]) => ({ unchanged: u, edited: e }))
}

/** The real-XI lineups, for callers that need a neutral starting point. */
export function realLineups(match: PlayedMatch): Record<SideKey, LineupState> {
  return { home: realLineupState(match.home), away: realLineupState(match.away) }
}
