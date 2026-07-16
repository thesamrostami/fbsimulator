import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from './lib/csv.mjs'

/**
 * Realism calibration from the international-results dataset:
 *
 * - Goal timing: empirical minute-of-goal distribution (5-minute bins,
 *   regulation and extra time separately). Real football scores more as each
 *   half ages; the engine multiplies its per-minute chance rate by these
 *   factors (mean 1 within regulation, mean 1 within extra time, so overall
 *   volume calibration is unaffected).
 *
 * - Shootouts: shootouts.csv records winners but NOT per-kick outcomes, so a
 *   per-kick conversion rate cannot be derived from it. We therefore pin the
 *   baseline to the published historical World Cup shootout conversion
 *   (~70–75%) and record that provenance honestly.
 */

export function buildCalibration({ rawDir, outFile, conversion = null }) {
  const goals = parseCsv(readFileSync(`${rawDir}/goalscorers.csv`, 'utf8'))
  const shootouts = parseCsv(readFileSync(`${rawDir}/shootouts.csv`, 'utf8'))

  const regBins = new Array(18).fill(0) // minutes 1–90 in 5' bins
  const etBins = new Array(6).fill(0) // minutes 91–120 in 5' bins
  let regTotal = 0
  let etTotal = 0
  for (const g of goals) {
    const minute = Number(g.minute)
    if (!Number.isFinite(minute) || minute < 1) continue
    if (minute <= 90) {
      regBins[Math.min(Math.floor((minute - 1) / 5), 17)] += 1
      regTotal += 1
    } else if (minute <= 120) {
      etBins[Math.min(Math.floor((minute - 91) / 5), 5)] += 1
      etTotal += 1
    }
  }

  const round4 = (x) => Math.round(x * 10000) / 10000
  const regShare = regBins.map((c) => round4(c / regTotal))
  const etShare = etBins.map((c) => round4(c / etTotal))
  // Factors with mean 1 inside each phase: factor = share * binCount.
  const regFactors = regBins.map((c) => round4((c / regTotal) * 18))
  const etFactors = etBins.map((c) => round4((c / etTotal) * 6))

  const out = {
    meta: {
      source:
        'https://github.com/martj42/international_results (goalscorers.csv, shootouts.csv)',
      retrievedAt: new Date().toISOString().slice(0, 10),
      license: 'Dataset dedicated to the public domain (CC0) by its maintainer.',
      goalsUsed: regTotal + etTotal,
      regulationGoals: regTotal,
      extraTimeGoals: etTotal,
      shootoutsRecorded: shootouts.length,
    },
    goalMinutes: {
      binMinutes: 5,
      regulationShare: regShare,
      regulationFactors: regFactors,
      extraTimeShare: etShare,
      extraTimeFactors: etFactors,
    },
    shootout: {
      baseConversion: 0.75,
      note:
        'shootouts.csv lists winners only (no per-kick outcomes); 0.75 follows the published historical World Cup shootout conversion rate of ~70–75%.',
    },
    ...(conversion ? { conversion } : {}),
  }
  writeFileSync(outFile, JSON.stringify(out, null, 1))
  return out
}
