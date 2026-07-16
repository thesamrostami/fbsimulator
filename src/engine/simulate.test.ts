import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { simulateMatch } from './simulate'

const mexEng = MATCHES['r16-4'] as PlayedMatch
const home = buildRealSheet(mexEng.home)
const away = buildRealSheet(mexEng.away)

describe('simulateMatch', () => {
  it('is deterministic for a given seed', () => {
    const a = simulateMatch(home, away, 1234)
    const b = simulateMatch(home, away, 1234)
    expect(b.finalScore).toEqual(a.finalScore)
    expect(b.events).toEqual(a.events)
    expect(b.xgTimeline).toEqual(a.xgTimeline)
    expect(b.stats).toEqual(a.stats)
  })

  it('produces different matches for different seeds', () => {
    const results = [1, 2, 3, 4, 5].map((seed) => simulateMatch(home, away, seed))
    const signatures = new Set(results.map((r) => JSON.stringify(r.events.map((e) => [e.minute, e.type]))))
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('keeps events ordered and the score consistent', () => {
    const result = simulateMatch(home, away, 42)

    expect(result.events[0]?.type).toBe('kickoff')
    expect(result.events.at(-1)?.type).toBe('full-time')

    let lastMinute = 0
    let goals = { home: 0, away: 0 }
    for (const event of result.events) {
      expect(event.minute).toBeGreaterThanOrEqual(lastMinute)
      lastMinute = event.minute
      if (event.type === 'goal') {
        goals = { ...goals, [event.side ?? 'home']: goals[event.side ?? 'home'] + 1 }
        expect(event.score).toEqual(goals)
        expect(event.player).toBeDefined()
      }
      expect(event.commentary.length).toBeGreaterThan(10)
    }
    expect(result.finalScore).toEqual(goals)
    expect(result.events.at(-1)?.score).toEqual(result.finalScore)
  })

  it('tracks cumulative xG minute by minute', () => {
    const result = simulateMatch(home, away, 7)
    expect(result.xgTimeline).toHaveLength(90)
    let prev = { home: 0, away: 0 }
    for (const point of result.xgTimeline) {
      expect(point.home).toBeGreaterThanOrEqual(prev.home)
      expect(point.away).toBeGreaterThanOrEqual(prev.away)
      prev = point
    }
    expect(result.xgTimeline.at(-1)?.home).toBeCloseTo(result.stats.home.xg, 1)
  })

  it('emits substitution windows', () => {
    const result = simulateMatch(home, away, 9)
    const windows = result.events.filter((e) => e.type === 'sub-window').map((e) => e.minute)
    expect(windows).toEqual([60, 75])
  })

  it('counts possession that sums to 100', () => {
    const result = simulateMatch(home, away, 11)
    expect(result.stats.home.possession + result.stats.away.possession).toBe(100)
  })

  it('never runs extra time outside knockout mode', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = simulateMatch(home, away, seed)
      expect(result.wentToExtraTime).toBe(false)
      expect(result.shootout).toBeUndefined()
      expect(result.winner).toBeUndefined()
      expect(result.xgTimeline).toHaveLength(90)
    }
  })

  it('attaches reasoning with the underlying numbers to explainable events', () => {
    const result = simulateMatch(home, away, 42)
    const explainable = result.events.filter((e) =>
      ['goal', 'shot-saved', 'shot-miss', 'yellow-card', 'red-card', 'momentum'].includes(e.type),
    )
    expect(explainable.length).toBeGreaterThan(0)
    for (const event of explainable) {
      expect(event.reasoning).toBeDefined()
      expect(event.reasoning!.length).toBeGreaterThan(30)
    }
    const shot = explainable.find((e) => e.type === 'goal' || e.type.startsWith('shot'))
    expect(shot?.reasoning).toMatch(/attack \d+ vs defence \d+/)
    expect(shot?.reasoning).toMatch(/possession weight \d+%/)
    expect(shot?.reasoning).toMatch(/keeper quality \d+/)
  })

  it('tilts chance creation toward the side given the real possession share', () => {
    let dominantGoals = 0
    let starvedGoals = 0
    for (let seed = 1; seed <= 120; seed += 1) {
      dominantGoals += simulateMatch(home, away, seed, { homePossession: 0.9 }).finalScore.home
      starvedGoals += simulateMatch(home, away, seed, { homePossession: 0.1 }).finalScore.home
    }
    expect(dominantGoals).toBeGreaterThan(starvedGoals)
  })
})
