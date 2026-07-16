import { describe, expect, it } from 'vitest'
import { computeSheetStrength } from '../engine/ratings'
import generated from './generated/team_strength.json'
import { buildRealSheet, PLAYED_MATCHES } from './matches'
import { TEAMS, type TeamId } from './teams'
import { baselineFor } from './teamStrength'

describe('fitted team strength (team_strength.json)', () => {
  it('carries provenance metadata', () => {
    expect(generated.meta.source).toContain('martj42/international_results')
    expect(generated.meta.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(generated.meta.matchesUsed).toBeGreaterThan(3000)
  })

  it('has a fresh, well-sampled fit for all 16 knockout teams', () => {
    for (const teamId of Object.keys(TEAMS) as TeamId[]) {
      const baseline = baselineFor(teamId)
      expect(baseline.raw.matches, teamId).toBeGreaterThanOrEqual(30)
      expect(baseline.raw.lastMatch >= '2026-06-01', `${teamId} played at the World Cup`).toBe(true)
      expect(baseline.attack).toBeGreaterThan(0)
      expect(baseline.defence).toBeGreaterThan(0)
    }
  })

  it('ranks elite sides above minnow-tier teams', () => {
    const quality = (name: string) => {
      const t = generated.teams[name as keyof typeof generated.teams]
      expect(t, name).toBeDefined()
      return t.attack + t.defence
    }
    for (const elite of ['Spain', 'Argentina', 'France']) {
      for (const minnow of ['Panama', 'San Marino', 'Hong Kong']) {
        expect(quality(elite), `${elite} > ${minnow}`).toBeGreaterThan(quality(minnow))
      }
    }
    // Home advantage and scoring level land in football-plausible ranges.
    expect(generated.meta.homeAdvantage).toBeGreaterThan(0.1)
    expect(generated.meta.homeAdvantage).toBeLessThan(0.5)
    expect(generated.meta.avgGoalsPerSideNeutral).toBeGreaterThan(0.8)
    expect(generated.meta.avgGoalsPerSideNeutral).toBeLessThan(2)
  })

  it('reproduces the baseline exactly for every real XI in its real formation', () => {
    for (const match of PLAYED_MATCHES) {
      for (const sideDef of [match.home, match.away]) {
        const strength = computeSheetStrength(buildRealSheet(sideDef))
        const baseline = baselineFor(sideDef.teamId)
        expect(strength.attack, `${match.id} ${sideDef.teamId} attack`).toBeCloseTo(baseline.attack, 10)
        expect(strength.defence, `${match.id} ${sideDef.teamId} defence`).toBeCloseTo(baseline.defence, 10)
      }
    }
  })

  it('shifts off the baseline when the lineup weakens', () => {
    const match = PLAYED_MATCHES.find((m) => m.id === 'r16-4')!
    const sheet = buildRealSheet(match.away)
    // Put the backup keeper up front: attack must drop below the baseline.
    const backupKeeper = sheet.bench.find((p) => p.ratings.position === 'GK')!
    expect(backupKeeper).toBeDefined()
    const weakened = {
      ...sheet,
      starters: sheet.starters.map((a) => (a.slot.id === 'f2' ? { ...a, player: backupKeeper } : a)),
    }
    const strength = computeSheetStrength(weakened)
    expect(strength.attack).toBeLessThan(baselineFor('ENG').attack)
  })
})
