import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fitTeamStrength } from './team-strength.mjs'
import { buildCalibration } from './calibration.mjs'
import { statsbombConversion } from './statsbomb.mjs'

/**
 * Offline data pipeline: raw sources → versioned JSON in src/data/generated/.
 * Deterministic given the same raw inputs; raw downloads are cached in
 * data/raw/ (pass --refetch to re-download). The app only ever imports the
 * generated JSON at build time.
 */

const RAW = 'data/raw/international'
const GEN = 'src/data/generated'
const FILES = ['results.csv', 'goalscorers.csv', 'shootouts.csv']
const BASE = 'https://raw.githubusercontent.com/martj42/international_results/master'

mkdirSync(RAW, { recursive: true })
mkdirSync(GEN, { recursive: true })

const refetch = process.argv.includes('--refetch')
for (const file of FILES) {
  const dest = `${RAW}/${file}`
  if (refetch || !existsSync(dest)) {
    console.log(`fetching ${file}…`)
    execSync(`curl -sL -o "${dest}" "${BASE}/${file}"`, { stdio: 'inherit' })
  }
}

console.log('fitting team strength (Dixon-Coles-style weighted Poisson)…')
const strength = fitTeamStrength({ rawDir: RAW, outFile: `${GEN}/team_strength.json` })
console.log(
  `  ${strength.meta.matchesUsed} matches, ${Object.keys(strength.teams).length} teams, ` +
    `μ=${strength.meta.mu} (≈${strength.meta.avgGoalsPerSideNeutral} goals/side), home adv γ=${strength.meta.homeAdvantage}`,
)

console.log('fetching StatsBomb WC2022 knockout shots (cached)…')
const conversion = statsbombConversion()
console.log(
  `  ${conversion.sample.shots} shots in ${conversion.sample.matches} matches — ` +
    `shots→goals ${conversion.shotsToGoals}, on-target ${conversion.onTargetShare}, xG/shot ${conversion.xgPerShot}`,
)

console.log('building realism calibration (goal timing, conversion, shootouts)…')
const calibration = buildCalibration({ rawDir: RAW, outFile: `${GEN}/calibration.json`, conversion })
console.log(
  `  ${calibration.meta.goalsUsed} goals binned, shootout base conversion ${calibration.shootout.baseConversion}`,
)

if (existsSync('data/raw/fc26') && (await import('node:fs')).readdirSync('data/raw/fc26').some((f) => f.endsWith('.csv'))) {
  console.log('matching FC 26 player ratings…')
  const { buildPlayerRatings } = await import('./player-ratings.mjs')
  const result = buildPlayerRatings({
    outFile: `${GEN}/player_ratings.json`,
    reportFile: 'pipeline/reports/player_matching.md',
  })
  console.log(
    `  ${result.matched}/${result.roster} matched, ${result.unmatched} unmatched, ${result.suspicious} flagged → pipeline/reports/player_matching.md`,
  )
} else {
  console.log('skipping FC 26 ratings (data/raw/fc26/ has no CSV)')
}

console.log('pipeline done → src/data/generated/')
