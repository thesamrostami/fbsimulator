import { describe, expect, it } from 'vitest'
import { buildRealSheet, PLAYED_MATCHES, type PlayedMatch } from '../data/matches'
import { runMonteCarlo } from './monteCarlo'

/**
 * Calibration: with the REAL lineups, the real winner should win a plausible
 * share of Monte-Carlo replays. This is an honesty check on the estimated
 * ratings — when a match fails, the failure is logged so the ratings can be
 * reviewed deliberately, never silently retuned.
 */

const RUNS = 500
const PLAUSIBLE_SHARE = 30 // percent
const MAX_FAILURES = 3 // the real winner must win plausibly in all but a few matches

function realWinnerSide(match: PlayedMatch): 'home' | 'away' {
  if (match.real.score.home !== match.real.score.away) {
    return match.real.score.home > match.real.score.away ? 'home' : 'away'
  }
  return match.real.pensWinner ?? 'home'
}

describe(`calibration against the ${PLAYED_MATCHES.length} real results`, () => {
  it(`real winner wins ≥${PLAUSIBLE_SHARE}% of ${RUNS} replays in at least ${PLAYED_MATCHES.length - MAX_FAILURES} of ${PLAYED_MATCHES.length} matches`, () => {
    const rows: { id: string; fixture: string; winnerShare: number; pass: boolean }[] = []

    for (const match of PLAYED_MATCHES) {
      const home = buildRealSheet(match.home)
      const away = buildRealSheet(match.away)
      const mc = runMonteCarlo(home, away, RUNS, 20260719, {
        knockout: true,
        homePossession: match.real.possession.home / 100,
      })
      const winner = realWinnerSide(match)
      const winnerShare = winner === 'home' ? mc.homeWinPct : mc.awayWinPct
      rows.push({
        id: match.id,
        fixture: `${match.home.teamId} ${match.real.score.home}-${match.real.score.away} ${match.away.teamId}${match.real.decidedBy ? ` (${match.real.decidedBy})` : ''}`,
        winnerShare,
        pass: winnerShare >= PLAUSIBLE_SHARE,
      })
    }

    const failures = rows.filter((row) => !row.pass)
    // Always print the table: this is the ratings review report.
    console.info('\nCalibration report (real winner share of replays):')
    for (const row of rows) {
      console.info(
        `  ${row.pass ? 'PASS' : 'FAIL'}  ${row.id.padEnd(6)} ${row.fixture.padEnd(24)} winner wins ${row.winnerShare}%`,
      )
    }
    if (failures.length > 0) {
      console.warn(
        `Calibration: ${failures.length} match(es) below ${PLAUSIBLE_SHARE}%: ${failures
          .map((f) => `${f.id} (${f.winnerShare}%)`)
          .join(', ')} — review these ratings deliberately.`,
      )
    }

    expect(failures.length).toBeLessThanOrEqual(MAX_FAILURES)
  })
})
