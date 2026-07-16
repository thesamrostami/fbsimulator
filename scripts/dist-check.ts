// One-off calibration check: prints the Monte Carlo distribution for every
// played match with its real lineups. Run with: npx vite-node scripts/dist-check.ts
import { buildRealSheet, PLAYED_MATCHES } from '../src/data/matches'
import { runMonteCarlo } from '../src/engine/monteCarlo'
import { computeSheetStrength } from '../src/engine/ratings'
import { simulateMatch } from '../src/engine/simulate'

for (const match of PLAYED_MATCHES) {
  const home = buildRealSheet(match.home)
  const away = buildRealSheet(match.away)
  const options = { knockout: true, homePossession: match.real.possession.home / 100 }
  const mc = runMonteCarlo(home, away, 1000, 20260704, options)
  const hs = computeSheetStrength(home)
  const as = computeSheetStrength(away)
  console.log(
    `${match.id.padEnd(6)} ${home.teamId} ${mc.homeWinPct}% - ${away.teamId} ${mc.awayWinPct}%` +
      ` (ET ${mc.extraTimePct}%, pens ${mc.shootoutPct}%)` +
      ` | real ${match.real.score.home}-${match.real.score.away}${match.real.decidedBy ? ` ${match.real.decidedBy}` : ''}` +
      ` | att/mid/def ${Math.round(hs.attack)}/${Math.round(hs.midfield)}/${Math.round(hs.defence)}` +
      ` vs ${Math.round(as.attack)}/${Math.round(as.midfield)}/${Math.round(as.defence)}`,
  )
}

const mexEng = PLAYED_MATCHES.find((m) => m.id === 'r16-4')!
const sample = simulateMatch(buildRealSheet(mexEng.home), buildRealSheet(mexEng.away), 42, {
  knockout: true,
  homePossession: 0.66,
})
console.log(
  '\nsample MEX-ENG:', sample.finalScore,
  'shots', sample.stats.home.shots, '-', sample.stats.away.shots,
  'xg', sample.stats.home.xg, '-', sample.stats.away.xg,
  'possession', sample.stats.home.possession, '-', sample.stats.away.possession,
)
