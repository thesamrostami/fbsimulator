import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { simulateMatch } from '../engine/simulate'
import { BIG_CHANCE_XG, buildMatchReport, reportEntries } from './matchReport'

const mexEng = MATCHES['r16-4'] as PlayedMatch
const suiCol = MATCHES['r16-8'] as PlayedMatch

const OPTIONS = { knockout: true, homePossession: 0.66 }

describe('match report', () => {
  it('reconstructs identically from the stored seed (deterministic persistence)', () => {
    const home = buildRealSheet(mexEng.home)
    const away = buildRealSheet(mexEng.away)
    const live = simulateMatch(home, away, 987654, OPTIONS)
    const restored = simulateMatch(buildRealSheet(mexEng.home), buildRealSheet(mexEng.away), 987654, OPTIONS)

    expect(restored.events).toEqual(live.events)
    expect(buildMatchReport(mexEng, restored).text).toBe(buildMatchReport(mexEng, live).text)
  })

  it('keeps goals, cards and phase markers; filters shots below the big-chance bar', () => {
    const sim = simulateMatch(buildRealSheet(mexEng.home), buildRealSheet(mexEng.away), 42, OPTIONS)
    const entries = reportEntries(sim)
    const events = entries.filter((e) => e.kind === 'event').map((e) => e.event)

    for (const type of ['kickoff', 'full-time'] as const) {
      expect(events.some((e) => e.type === type), type).toBe(true)
    }
    const simGoals = sim.events.filter((e) => e.type === 'goal').length
    expect(events.filter((e) => e.type === 'goal')).toHaveLength(simGoals)
    for (const e of events) {
      if (e.type === 'shot-saved' || e.type === 'shot-miss') {
        expect(e.xg ?? 0).toBeGreaterThanOrEqual(BIG_CHANCE_XG)
      }
    }
  })

  it('includes every shootout kick with commentary and odds', () => {
    // Mirror sheets make level-at-120 (and thus shootouts) common.
    const home = buildRealSheet(suiCol.home)
    const away = { ...buildRealSheet(suiCol.home), teamId: 'COL', name: 'Mirror' }
    let sim = null
    for (let seed = 1; seed <= 200; seed += 1) {
      const candidate = simulateMatch(home, away, seed, { knockout: true })
      if (candidate.shootout) {
        sim = candidate
        break
      }
    }
    expect(sim?.shootout).toBeDefined()
    const { entries, text } = buildMatchReport(suiCol, sim!)
    const kicks = entries.filter((e) => e.kind === 'kick')
    expect(kicks).toHaveLength(sim!.shootout!.kicks.length)
    for (const kick of sim!.shootout!.kicks) {
      expect(kick.commentary.length).toBeGreaterThan(10)
    }
    expect(text).toContain('PK1')
    expect(text).toMatch(/% odds/)
    // Kicks are listed between the shootout marker and full-time.
    const flatKinds = entries.map((e) => (e.kind === 'event' ? e.event.type : 'kick'))
    expect(flatKinds.indexOf('kick')).toBeGreaterThan(flatKinds.indexOf('penalties'))
    expect(flatKinds.lastIndexOf('kick')).toBeLessThan(flatKinds.indexOf('full-time'))
  })

  it('renders a clean text header with both scorelines', () => {
    const sim = simulateMatch(buildRealSheet(mexEng.home), buildRealSheet(mexEng.away), 42, OPTIONS)
    const { text } = buildMatchReport(mexEng, sim)
    expect(text).toContain('MATCH REPORT · Round of 16')
    expect(text).toContain(`Mexico ${sim.finalScore.home}–${sim.finalScore.away} England`)
    expect(text).toContain('Real result: 2–3')
    expect(text).toContain(`Seed ${sim.seed}`)
  })
})
