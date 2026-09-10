import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { simulateMatch } from '../engine/simulate'
import type { SimResult } from '../engine/types'
import { buildMatchReport } from './matchReport'
import { passAccuracy, rateMatch, RATING_WEIGHTS } from './playerRatings'

const match = MATCHES['r16-4'] as PlayedMatch
const home = buildRealSheet(match.home)
const away = buildRealSheet(match.away)
const options = { knockout: true, homePossession: match.real.possession.home / 100 }
const sims: SimResult[] = Array.from({ length: 12 }, (_, i) => simulateMatch(home, away, i * 13 + 5, options))

describe('rateMatch', () => {
  it('rates every player who took the pitch, on the 4–10 scale, sorted best first per side', () => {
    for (const sim of sims) {
      const r = rateMatch(sim)
      expect(r.home.length).toBe(11)
      expect(r.away.length).toBe(11)
      for (const row of [...r.home, ...r.away]) {
        expect(row.rating).toBeGreaterThanOrEqual(RATING_WEIGHTS.min)
        expect(row.rating).toBeLessThanOrEqual(RATING_WEIGHTS.max)
        expect(row.minutes).toBeGreaterThan(0)
        expect(row.minutes).toBeLessThanOrEqual(sim.wentToExtraTime ? 120 : 90)
        expect(row.name.length).toBeGreaterThan(0)
      }
      for (const side of [r.home, r.away]) {
        for (let i = 1; i < side.length; i++) expect(side[i - 1].rating).toBeGreaterThanOrEqual(side[i].rating)
      }
      expect(r.motm).not.toBeNull()
      expect(r.motm!.rating).toBe(Math.max(...[...r.home, ...r.away].map((p) => p.rating)))
    }
  })

  it('scores goals and assists above a quiet match, and punishes a red card', () => {
    const sim = sims.find((s) => s.events.some((e) => e.type === 'goal' && e.assist))!
    const r = rateMatch(sim)
    const goal = sim.events.find((e) => e.type === 'goal' && e.assist)!
    const all = [...r.home, ...r.away]
    const scorer = all.find((p) => p.playerId === goal.player!.id)!
    const creator = all.find((p) => p.playerId === goal.assist!.id)!
    const quiet = all.filter((p) => p.stats.shots === 0 && p.stats.keyPasses === 0 && p.stats.tackles <= 1)
    expect(scorer.rating).toBeGreaterThan(RATING_WEIGHTS.base)
    expect(creator.rating).toBeGreaterThan(RATING_WEIGHTS.base - 0.5)
    for (const q of quiet) expect(scorer.rating).toBeGreaterThan(q.rating)

    const red = sims.flatMap((s) => {
      const e = s.events.find((x) => x.type === 'red-card')
      return e ? [{ s, e }] : []
    })[0]
    if (red) {
      const rr = rateMatch(red.s)
      const row = [...rr.home, ...rr.away].find((p) => p.playerId === red.e.player!.id)!
      expect(row.minutes).toBe(red.e.minute)
      expect(row.rating).toBeLessThan(RATING_WEIGHTS.base)
    }
  })

  it('credits the keeper for saves and the back line for a clean sheet', () => {
    const cleanSheet = sims.find((s) => s.finalScore.home === 0 || s.finalScore.away === 0)
    if (!cleanSheet) return
    const side = cleanSheet.finalScore.away === 0 ? 'home' : 'away'
    const r = rateMatch(cleanSheet)[side]
    const gk = r.find((p) => p.line === 'GK')!
    expect(gk.rating).toBeGreaterThanOrEqual(RATING_WEIGHTS.base + RATING_WEIGHTS.cleanSheet - 0.3)
  })

  it('is deterministic and feeds the text report', () => {
    const a = rateMatch(sims[0])
    const b = rateMatch(sims[0])
    expect(b).toEqual(a)
    const report = buildMatchReport(match, sims[0], a)
    expect(report.text).toMatch(/Man of the match: .+ rated \d\.\d/)
    expect(report.text).toMatch(/Possession \d+% – \d+%/)
    expect(passAccuracy({ passes: 0, passesCompleted: 0 })).toBeNull()
    expect(passAccuracy({ passes: 10, passesCompleted: 7 })).toBe(70)
  })
})
