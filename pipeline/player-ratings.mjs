import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { parseCsv } from './lib/csv.mjs'
import { fc26Line, normalizeName, scoreCandidate } from './lib/match-names.mjs'

/**
 * Join our roster (players.ts) to EA SPORTS FC 26 ratings from the Kaggle
 * community extract in data/raw/fc26/. Matching requires nationality
 * agreement and a confident name score; low-confidence candidates are left
 * unmatched (the app keeps its editorial estimate) and everything is written
 * to pipeline/reports/player_matching.md for human review.
 */

const COUNTRY_BY_PREFIX = {
  par: 'Paraguay',
  fra: 'France',
  can: 'Canada',
  mar: 'Morocco',
  bra: 'Brazil',
  nor: 'Norway',
  mex: 'Mexico',
  eng: 'England',
  por: 'Portugal',
  esp: 'Spain',
  usa: 'United States',
  bel: 'Belgium',
  arg: 'Argentina',
  egy: 'Egypt',
  sui: 'Switzerland',
  col: 'Colombia',
}

const ACCEPT_SCORE = 0.87
const CLEAR_MARGIN = 0.02

function loadRoster() {
  const source = readFileSync('src/data/players.ts', 'utf8')
  const roster = []
  const re = /p\(\s*'([^']+)',\s*(?:'([^']*)'|"([^"]*)"),\s*\d+,\s*'(GK|DEF|MID|FWD)'/g
  let m
  while ((m = re.exec(source)) !== null) {
    const id = m[1]
    roster.push({
      id,
      name: m[2] ?? m[3],
      position: m[4],
      country: COUNTRY_BY_PREFIX[id.split('-')[0]],
    })
  }
  return roster
}

const clampInt = (x) => Math.max(1, Math.min(99, Math.round(x)))

function mapRatings(row) {
  if (row.player_positions.split(',')[0].trim() === 'GK') {
    // Our GK schema: defending proxies shot-stopping (engine: gk = def·0.8 + phy·0.2).
    return {
      pace: clampInt(Number(row.goalkeeping_speed || 45)),
      shooting: clampInt(Number(row.goalkeeping_kicking || 40) * 0.5),
      passing: clampInt(Number(row.goalkeeping_kicking || 55)),
      defending: clampInt(
        0.4 * Number(row.goalkeeping_reflexes) + 0.3 * Number(row.goalkeeping_diving) + 0.3 * Number(row.goalkeeping_handling),
      ),
      physical: clampInt(Number(row.goalkeeping_positioning)),
    }
  }
  return {
    pace: clampInt(Number(row.pace)),
    shooting: clampInt(Number(row.shooting)),
    passing: clampInt(Number(row.passing)),
    defending: clampInt(Number(row.defending)),
    physical: clampInt(Number(row.physic)),
  }
}

export function buildPlayerRatings({ outFile, reportFile }) {
  const dir = 'data/raw/fc26'
  const csvName = readdirSync(dir).find((f) => f.endsWith('.csv'))
  if (!csvName) throw new Error('data/raw/fc26/ has no CSV — aborting (no estimates substituted).')
  const csvPath = `${dir}/${csvName}`
  const fc = parseCsv(readFileSync(csvPath, 'utf8'))
  const roster = loadRoster()

  const byCountry = new Map()
  for (const row of fc) {
    const list = byCountry.get(row.nationality_name) ?? []
    list.push(row)
    byCountry.set(row.nationality_name, list)
  }

  const matched = []
  const suspicious = []
  const unmatched = []
  const players = {}
  const claimed = new Map() // fc26 player_id -> { rosterId, score }

  const candidatesFor = (player) => {
    const pool = byCountry.get(player.country) ?? []
    return (
      pool
        .map((row) => ({ row, score: scoreCandidate(player.name, row.short_name, row.long_name), line: fc26Line(row.player_positions) }))
        // Keepers and outfielders can never be the same person in our data.
        .filter((c) => c.score >= 0.8 && (c.line === 'GK') === (player.position === 'GK'))
        // Same-line candidates outrank cross-line ones at equal name score;
        // overall breaks remaining ties (squad players are the notable ones).
        .sort(
          (a, b) =>
            b.score - a.score ||
            Number(b.line === player.position) - Number(a.line === player.position) ||
            Number(b.row.overall) - Number(a.row.overall),
        )
    )
  }

  // Two passes: resolve, then enforce that no FC 26 record serves two roster
  // ids (highest name-score keeps it; the loser reverts to its estimate).
  const resolved = roster.map((player) => ({ player, scored: candidatesFor(player) }))
  for (const { player, scored } of resolved) {
    const best = scored[0]
    if (best && best.score >= ACCEPT_SCORE) {
      const prev = claimed.get(best.row.player_id)
      if (!prev || best.score > prev.score) claimed.set(best.row.player_id, { rosterId: player.id, score: best.score })
    }
  }

  for (const { player, scored } of resolved) {
    const best = scored[0]
    if (!best || best.score < ACCEPT_SCORE) {
      unmatched.push({ ...player, note: best ? `best ${best.row.long_name} @${best.score.toFixed(3)}` : 'no candidate' })
      continue
    }
    if (claimed.get(best.row.player_id)?.rosterId !== player.id) {
      unmatched.push({ ...player, note: `duplicate: ${best.row.long_name} belongs to ${claimed.get(best.row.player_id)?.rosterId}` })
      continue
    }
    const runnerUp = scored.find((c) => normalizeName(c.row.long_name) !== normalizeName(best.row.long_name))
    // Wingers and attacking mids straddle our FWD/MID line boundary: a player
    // we field as FWD may be CAM/RM/LM in FC 26 — treat that as agreement.
    const attackingMid = /^(CAM|RM|LM)/.test((best.row.player_positions ?? '').split(',')[0].trim())
    const lineAgrees = best.line === player.position || (player.position === 'FWD' && attackingMid)
    // Line agreement contributes to the margin, so a same-name relative in a
    // different line (Jobe vs Jude Bellingham class) doesn't force a tie.
    const adj = (c) => c.score + (c.line === player.position ? 0.02 : 0)
    const margin = runnerUp ? adj(best) - adj(runnerUp) : 1
    const confidence =
      margin >= CLEAR_MARGIN && lineAgrees ? (best.score >= 0.97 ? 'high' : 'medium') : 'review'
    // Review-class matches are only APPLIED when the name is near-exact and
    // the line agrees (ties among relatives, resolved by overall), or when the
    // name is near-exact AND clearly unique in the country pool — our line
    // labels come from lineup slots, so a genuine winger we list as MID must
    // not block an unambiguous name match. Fuzzy or contested cross-line
    // picks are reported for human review and NOT applied.
    const applied =
      confidence !== 'review' || (best.score >= 0.95 && lineAgrees) || (best.score >= 0.97 && margin >= 0.05)
    if (confidence === 'review') {
      suspicious.push({
        ...player,
        applied,
        pick: `${best.row.long_name} (${best.line}, ovr ${best.row.overall}) @${best.score.toFixed(3)}`,
        alt: runnerUp
          ? `${runnerUp.row.long_name} (${runnerUp.line}, ovr ${runnerUp.row.overall}) @${runnerUp.score.toFixed(3)}`
          : lineAgrees
            ? 'none'
            : `line mismatch: ours ${player.position}`,
      })
    }
    if (!applied) {
      unmatched.push({ ...player, note: `review-rejected: ${best.row.long_name} @${best.score.toFixed(3)} (${best.line})` })
      continue
    }
    players[player.id] = {
      ...mapRatings(best.row),
      source: 'fc26',
      fc26Name: best.row.long_name,
      overall: Number(best.row.overall),
      confidence,
    }
    matched.push({ ...player, pick: best.row.long_name, score: best.score, confidence, overall: Number(best.row.overall) })
  }

  const retrieved = statSync(csvPath).mtime.toISOString().slice(0, 10)
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: {
          source: `EA SPORTS FC 26 player data — unofficial community extract via Kaggle (file: ${csvName})`,
          attribution:
            'Unofficial dataset; EA SPORTS FC 26 ratings are editorial content of EA. Credit to the Kaggle dataset author (rovnez).',
          retrievedAt: retrieved,
          rosterSize: roster.length,
          matched: matched.length,
          unmatched: unmatched.length,
          acceptThreshold: ACCEPT_SCORE,
        },
        players,
      },
      null,
      1,
    ),
  )

  const lines = [
    '# FC 26 player matching report',
    '',
    `Source CSV: \`${csvName}\` (retrieved ${retrieved}) · roster ${roster.length} · matched ${matched.length} · unmatched ${unmatched.length} · flagged for review ${suspicious.length}`,
    '',
    '## Unmatched (keep editorial estimate)',
    '',
    ...unmatched.map((u) => `- **${u.name}** (${u.id}, ${u.country}) — ${u.note}`),
    '',
    '## Flagged for review',
    '',
    ...suspicious.map(
      (s) => `- ${s.applied ? '✅ applied' : '⛔ kept estimate'} — **${s.name}** (${s.id}) → ${s.pick} · runner-up: ${s.alt}`,
    ),
    '',
    '## Matched',
    '',
    '| ours | FC 26 | score | confidence | overall |',
    '|---|---|---|---|---|',
    ...matched.map((m) => `| ${m.name} (${m.id}) | ${m.pick} | ${m.score.toFixed(3)} | ${m.confidence} | ${m.overall} |`),
    '',
  ]
  writeFileSync(reportFile, lines.join('\n'))
  return { matched: matched.length, unmatched: unmatched.length, suspicious: suspicious.length, roster: roster.length }
}
