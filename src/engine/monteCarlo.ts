import { cloneHalftimeState, resumeMatch, simulateMatch, type HalftimeState } from './simulate'
import type { MonteCarloResult, ScorelineCount, SimOptions, SimResult, TeamSheet } from './types'

/**
 * Replay the fixture n times with derived seeds. Fully reproducible for a
 * given baseSeed. Pure and synchronous so a server could run it as-is; the UI
 * wraps it in an async boundary.
 *
 * In knockout mode every replay produces a winner (extra time, then
 * penalties), so drawPct is 0 and the extra-time/shootout shares are reported.
 */
export function runMonteCarlo(
  home: TeamSheet,
  away: TeamSheet,
  runs: number,
  baseSeed: number,
  options: SimOptions = {},
): MonteCarloResult {
  return collect(runs, baseSeed, Boolean(options.knockout), (seed) => simulateMatch(home, away, seed, options))
}

/**
 * Monte Carlo over the rest of a paused match: every run clones the frozen
 * state (same score, cards and history so far — at the break or at a
 * substitution window), applies the candidate sheets and replays the
 * remaining minutes from a derived seed. The seed derivation matches
 * runMonteCarlo's, so two calls with the same baseSeed differ only by the
 * sheets — the delta is the change, not sampling noise.
 */
export function runSecondHalfMonteCarlo(
  state: HalftimeState,
  home: TeamSheet,
  away: TeamSheet,
  runs: number,
  baseSeed: number,
): MonteCarloResult {
  return collect(runs, baseSeed, Boolean(state.options.knockout), (seed) =>
    resumeMatch(cloneHalftimeState(state, seed), home, away),
  )
}

function collect(
  runs: number,
  baseSeed: number,
  knockout: boolean,
  simAt: (seed: number) => SimResult,
): MonteCarloResult {
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  let extraTimes = 0
  let shootouts = 0
  let homeGoals = 0
  let awayGoals = 0
  const scorelines = new Map<string, ScorelineCount>()

  for (let i = 0; i < runs; i += 1) {
    // Spread seeds so consecutive runs don't correlate.
    const sim = simAt(baseSeed + i * 7919)
    const { finalScore } = sim
    if (sim.winner === 'home' || finalScore.home > finalScore.away) homeWins += 1
    else if (sim.winner === 'away' || finalScore.home < finalScore.away) awayWins += 1
    else draws += 1
    if (sim.wentToExtraTime) extraTimes += 1
    if (sim.shootout) shootouts += 1
    homeGoals += finalScore.home
    awayGoals += finalScore.away

    const key = `${finalScore.home}-${finalScore.away}`
    const entry = scorelines.get(key) ?? { home: finalScore.home, away: finalScore.away, count: 0 }
    entry.count += 1
    scorelines.set(key, entry)
  }

  const pct = (n: number): number => Math.round((n / runs) * 1000) / 10

  return {
    runs,
    baseSeed,
    homeWinPct: pct(homeWins),
    drawPct: pct(draws),
    awayWinPct: pct(awayWins),
    ...(knockout ? { extraTimePct: pct(extraTimes), shootoutPct: pct(shootouts) } : {}),
    topScorelines: [...scorelines.values()].sort((a, b) => b.count - a.count),
    avgGoals: {
      home: Math.round((homeGoals / runs) * 100) / 100,
      away: Math.round((awayGoals / runs) * 100) / 100,
    },
  }
}
