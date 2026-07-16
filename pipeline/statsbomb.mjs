import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

/**
 * Shot-conversion calibration from StatsBomb Open Data (World Cup 2022
 * knockout stage — 16 matches, a bounded ~120MB fetch cached under
 * data/raw/statsbomb/). Aggregate rates only; nothing per-player.
 *
 * Attribution: data © StatsBomb, released under the StatsBomb Open Data
 * licence — free for research/personal use with credit to StatsBomb.
 */

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data'
const RAW = 'data/raw/statsbomb'
const COMPETITION = 43 // FIFA World Cup
const SEASON = 106 // 2022

const KNOCKOUT_STAGES = new Set([
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  '3rd Place Final',
  'Final',
])

function fetchCached(url, dest) {
  if (!existsSync(dest)) execSync(`curl -sL -o "${dest}" "${url}"`, { stdio: 'inherit' })
  return JSON.parse(readFileSync(dest, 'utf8'))
}

export function statsbombConversion() {
  mkdirSync(`${RAW}/events`, { recursive: true })
  const matches = fetchCached(
    `${BASE}/matches/${COMPETITION}/${SEASON}.json`,
    `${RAW}/matches_${COMPETITION}_${SEASON}.json`,
  )
  const knockouts = matches.filter((m) => KNOCKOUT_STAGES.has(m.competition_stage?.name))

  let shots = 0
  let goals = 0
  let onTarget = 0
  let xgSum = 0
  for (const m of knockouts) {
    const events = fetchCached(`${BASE}/events/${m.match_id}.json`, `${RAW}/events/${m.match_id}.json`)
    for (const e of events) {
      if (e.type?.name !== 'Shot') continue
      if (e.shot?.type?.name === 'Penalty') continue // in-game pens skew open-play rates
      shots += 1
      xgSum += e.shot?.statsbomb_xg ?? 0
      const outcome = e.shot?.outcome?.name
      if (outcome === 'Goal') {
        goals += 1
        onTarget += 1
      } else if (outcome === 'Saved' || outcome === 'Saved To Post') {
        onTarget += 1
      }
    }
  }

  const round4 = (x) => Math.round(x * 10000) / 10000
  return {
    source: 'https://github.com/statsbomb/open-data (World Cup 2022 knockout stage)',
    attribution: 'Data © StatsBomb — used under the StatsBomb Open Data licence, with thanks.',
    sample: { matches: knockouts.length, shots },
    shotsToGoals: round4(goals / shots),
    onTargetShare: round4(onTarget / shots),
    onTargetToGoals: round4(goals / onTarget),
    xgPerShot: round4(xgSum / shots),
  }
}
