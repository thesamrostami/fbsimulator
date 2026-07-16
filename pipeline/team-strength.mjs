import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from './lib/csv.mjs'

/**
 * Fit per-team attack/defence on real international results with a
 * Dixon-Coles-style weighted Poisson model.
 *
 *   log λ_home = μ + att_home − def_away + γ·(venue is truly home)
 *   log λ_away = μ + att_away − def_home
 *
 * Weighted MLE via gradient ascent (the log-likelihood is concave), with
 * exponential recency decay and competition-importance weights. We omit the
 * Dixon-Coles low-score ρ correction: it sharpens draw probabilities in
 * score-line prediction, but the app's engine only consumes each team's
 * attack/defence levels (the minute-level sim generates its own dynamics),
 * so ρ would not change anything downstream.
 *
 * Identifiability: attack and defence are centred to mean 0 (absorbed into μ),
 * so att=0/def=0 is the average international side. A small ridge prior
 * shrinks thin-sample teams toward average.
 */

const CONFIG = {
  cutoff: '2022-07-01', // ~4 years of results
  halfLifeYears: 1.5, // recency: weight halves every 18 months
  ridge: 3, // pseudo-match prior pulling low-data teams to average
  iterations: 150,
  damping: 0.5, // Fisher-scoring step damping (sequential blocks)
}

function importance(tournament) {
  if (tournament === 'FIFA World Cup') return 2.5
  if (/^(UEFA Euro|Copa América|African Cup of Nations|AFC Asian Cup|Gold Cup|CONCACAF Championship|OFC Nations Cup)$/.test(tournament)) return 2.0
  if (/qualification|Nations League|FIFA Series/.test(tournament)) return 1.5
  return 1.0 // friendlies and minor cups
}

export function fitTeamStrength({ rawDir, outFile, now = new Date() }) {
  const rows = parseCsv(readFileSync(`${rawDir}/results.csv`, 'utf8'))
  const matches = rows.filter(
    (r) => r.date >= CONFIG.cutoff && r.home_score !== 'NA' && r.home_score !== '' && r.away_score !== 'NA',
  )

  const msPerYear = 365.25 * 24 * 3600 * 1000
  const decay = Math.LN2 / CONFIG.halfLifeYears

  const teams = new Map() // name -> index
  for (const m of matches) {
    if (!teams.has(m.home_team)) teams.set(m.home_team, teams.size)
    if (!teams.has(m.away_team)) teams.set(m.away_team, teams.size)
  }
  const n = teams.size
  const att = new Float64Array(n)
  const def = new Float64Array(n)
  let mu = 0.2
  let gamma = 0.2

  const prepared = matches.map((m) => {
    const ageYears = (now - new Date(m.date)) / msPerYear
    return {
      h: teams.get(m.home_team),
      a: teams.get(m.away_team),
      hs: Number(m.home_score),
      as: Number(m.away_score),
      home: m.neutral !== 'TRUE',
      w: Math.exp(-decay * Math.max(ageYears, 0)) * importance(m.tournament),
      date: m.date,
    }
  })

  // Per-team totals for gradient normalisation and reporting.
  const sumW = new Float64Array(n)
  const counts = new Uint32Array(n)
  const lastMatch = new Array(n).fill('')
  for (const m of prepared) {
    sumW[m.h] += m.w
    sumW[m.a] += m.w
    counts[m.h] += 1
    counts[m.a] += 1
    if (m.date > lastMatch[m.h]) lastMatch[m.h] = m.date
    if (m.date > lastMatch[m.a]) lastMatch[m.a] = m.date
  }

  // Per-coordinate Fisher scoring (Newton step Σw(y−λ)/Σwλ), applied in
  // sequential blocks — att/def, then μ, then γ — each against freshly
  // computed λ. Simultaneous full steps diverge because every λ couples μ
  // with many att/def coordinates; sequential damped blocks are stable.
  const gAtt = new Float64Array(n)
  const gDef = new Float64Array(n)
  const hAtt = new Float64Array(n)
  const hDef = new Float64Array(n)
  const lambdas = (m) => {
    const lh = Math.exp(mu + att[m.h] - def[m.a] + (m.home ? gamma : 0))
    const la = Math.exp(mu + att[m.a] - def[m.h])
    return [lh, la]
  }

  for (let iter = 0; iter < CONFIG.iterations; iter += 1) {
    // Block 1: team attack/defence.
    gAtt.fill(0)
    gDef.fill(0)
    hAtt.fill(0)
    hDef.fill(0)
    for (const m of prepared) {
      const [lh, la] = lambdas(m)
      gAtt[m.h] += m.w * (m.hs - lh)
      hAtt[m.h] += m.w * lh
      gDef[m.a] -= m.w * (m.hs - lh)
      hDef[m.a] += m.w * lh
      gAtt[m.a] += m.w * (m.as - la)
      hAtt[m.a] += m.w * la
      gDef[m.h] -= m.w * (m.as - la)
      hDef[m.h] += m.w * la
    }
    for (let t = 0; t < n; t += 1) {
      att[t] += (CONFIG.damping * (gAtt[t] - CONFIG.ridge * att[t])) / (hAtt[t] + CONFIG.ridge)
      def[t] += (CONFIG.damping * (gDef[t] - CONFIG.ridge * def[t])) / (hDef[t] + CONFIG.ridge)
    }
    // Centre for identifiability (absorb means into μ).
    let mA = 0
    let mD = 0
    for (let t = 0; t < n; t += 1) {
      mA += att[t]
      mD += def[t]
    }
    mA /= n
    mD /= n
    for (let t = 0; t < n; t += 1) {
      att[t] -= mA
      def[t] -= mD
    }
    mu += mA - mD

    // Block 2: global scoring level μ.
    let gMu = 0
    let hMu = 0
    for (const m of prepared) {
      const [lh, la] = lambdas(m)
      gMu += m.w * (m.hs - lh + m.as - la)
      hMu += m.w * (lh + la)
    }
    mu += (CONFIG.damping * gMu) / hMu

    // Block 3: home advantage γ (true home venues only).
    let gGamma = 0
    let hGamma = 0
    for (const m of prepared) {
      if (!m.home) continue
      const [lh] = lambdas(m)
      gGamma += m.w * (m.hs - lh)
      hGamma += m.w * lh
    }
    gamma += (CONFIG.damping * gGamma) / hGamma
  }

  const round4 = (x) => Math.round(x * 10000) / 10000
  const out = {
    meta: {
      source: 'https://github.com/martj42/international_results (results.csv)',
      retrievedAt: new Date().toISOString().slice(0, 10),
      license: 'Dataset dedicated to the public domain (CC0) by its maintainer; attribution appreciated.',
      model: 'Dixon-Coles-style weighted Poisson (attack/defence per team, home advantage, no rho)',
      config: CONFIG,
      matchesUsed: prepared.length,
      mu: round4(mu),
      homeAdvantage: round4(gamma),
      avgGoalsPerSideNeutral: round4(Math.exp(mu)),
    },
    teams: Object.fromEntries(
      [...teams.entries()]
        .sort((x, y) => att[y[1]] + def[y[1]] - (att[x[1]] + def[x[1]]))
        .map(([name, t]) => [
          name,
          {
            attack: round4(att[t]),
            defence: round4(def[t]),
            expGoalsFor: round4(Math.exp(mu + att[t])),
            expGoalsAgainst: round4(Math.exp(mu - def[t])),
            matches: counts[t],
            lastMatch: lastMatch[t],
          },
        ]),
    ),
  }
  writeFileSync(outFile, JSON.stringify(out, null, 1))
  return out
}
