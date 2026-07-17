import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { runSecondHalfMonteCarlo } from './monteCarlo'
import {
  cloneHalftimeState,
  HALFTIME_MINUTE,
  playFirstHalf,
  resumeMatch,
  sentOffIds,
  simulateMatch,
} from './simulate'
import type { SimResult, TeamSheet } from './types'

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

describe('playFirstHalf + resumeMatch', () => {
  const options = { knockout: true, homePossession: mexEng.real.possession.home / 100 }

  /** England's second-half XI with the front three benched for the bench outfielders. */
  function weakenedAway(): TeamSheet {
    const replacements = away.bench.filter((p) => p.ratings.position !== 'GK')
    expect(replacements.length).toBeGreaterThanOrEqual(3)
    let next = 0
    return {
      ...away,
      starters: away.starters.map((a) =>
        a.slot.line === 'FWD' ? { slot: a.slot, player: replacements[next++] } : a,
      ),
    }
  }

  it('is byte-identical to simulateMatch when nothing changes at the break', () => {
    let firstHalfReds = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      const direct = simulateMatch(home, away, seed, options)
      const paused = playFirstHalf(home, away, seed, options)
      if (sentOffIds(paused).size > 0) firstHalfReds += 1
      const resumed = resumeMatch(paused, home, away)
      expect(resumed.finalScore, `seed ${seed}`).toEqual(direct.finalScore)
      expect(resumed.events, `seed ${seed}`).toEqual(direct.events)
      expect(resumed.xgTimeline, `seed ${seed}`).toEqual(direct.xgTimeline)
      expect(resumed, `seed ${seed}`).toEqual(direct)
    }
    // The tricky path — re-anchoring a side already down to ten — must be hit.
    expect(firstHalfReds).toBeGreaterThan(0)
  })

  it('is byte-identical without options too', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(resumeMatch(playFirstHalf(home, away, seed), home, away)).toEqual(
        simulateMatch(home, away, seed),
      )
    }
  })

  it('freezes exactly at the whistle', () => {
    const paused = playFirstHalf(home, away, 3, options)
    expect(paused.minutesPlayed).toBe(HALFTIME_MINUTE)
    expect(paused.xgTimeline).toHaveLength(HALFTIME_MINUTE)
    for (const event of paused.events) expect(event.minute).toBeLessThanOrEqual(HALFTIME_MINUTE)
  })

  it('refuses to resume the same consumed state twice', () => {
    const paused = playFirstHalf(home, away, 5, options)
    resumeMatch(paused, home, away)
    expect(() => resumeMatch(paused, home, away)).toThrow()
  })

  it('a half-time change alters only the second half', () => {
    const weakAway = weakenedAway()
    const firstHalfOf = (r: SimResult) => r.events.filter((e) => e.minute <= HALFTIME_MINUTE)
    let secondHalvesDiffer = 0
    for (let seed = 1; seed <= 10; seed += 1) {
      const direct = simulateMatch(home, away, seed, options)
      const changed = resumeMatch(playFirstHalf(home, away, seed, options), home, weakAway)
      expect(firstHalfOf(changed)).toEqual(firstHalfOf(direct))
      expect(changed.xgTimeline.slice(0, HALFTIME_MINUTE)).toEqual(
        direct.xgTimeline.slice(0, HALFTIME_MINUTE),
      )
      if (JSON.stringify(changed.events) !== JSON.stringify(direct.events)) secondHalvesDiffer += 1
    }
    expect(secondHalvesDiffer).toBeGreaterThan(0)
  })

  it('cloned replays are deterministic and leave the frozen state untouched', () => {
    const paused = playFirstHalf(home, away, 9, options)
    const eventCount = paused.events.length
    const a = resumeMatch(cloneHalftimeState(paused, 123), home, away)
    const b = resumeMatch(cloneHalftimeState(paused, 123), home, away)
    expect(b).toEqual(a)
    // The live match is untouched: still frozen at 45', still resumable.
    expect(paused.events).toHaveLength(eventCount)
    expect(paused.minutesPlayed).toBe(HALFTIME_MINUTE)
    expect(paused.home.stats.possession).toBe(0)
    expect(() => resumeMatch(paused, home, away)).not.toThrow()
  })

  it('runSecondHalfMonteCarlo: benching the attack at the break lowers that win share', () => {
    const paused = playFirstHalf(home, away, 77, options)
    const unchanged = runSecondHalfMonteCarlo(paused, paused.home.sheet, paused.away.sheet, 300, 4242)
    const weakened = runSecondHalfMonteCarlo(paused, paused.home.sheet, weakenedAway(), 300, 4242)
    expect(weakened.awayWinPct).toBeLessThan(unchanged.awayWinPct)
    // Reproducible: the same baseSeed replays the same second halves.
    expect(runSecondHalfMonteCarlo(paused, paused.home.sheet, paused.away.sheet, 300, 4242)).toEqual(
      unchanged,
    )
  })
})
