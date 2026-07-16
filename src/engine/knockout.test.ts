import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { createRng } from './rng'
import { shootoutTakers, simulateShootout } from './shootout'
import { simulateMatch } from './simulate'

const mexEng = MATCHES['r16-4'] as PlayedMatch
const home = buildRealSheet(mexEng.home)
const away = buildRealSheet(mexEng.away)

// A mirror match maximises level-at-90 replays so ET/shootout paths get hit.
const suiCol = MATCHES['r16-8'] as PlayedMatch
const mirrorHome = buildRealSheet(suiCol.home)
const mirrorAway = { ...buildRealSheet(suiCol.home), teamId: 'COL', name: 'Mirror' }

describe('knockout mode', () => {
  it('plays extra time exactly when level at 90 minutes', () => {
    let extraTimeSeen = 0
    let regulationSeen = 0
    for (let seed = 1; seed <= 80; seed += 1) {
      const result = simulateMatch(home, away, seed, { knockout: true })
      const levelAt90 = result.regulationScore.home === result.regulationScore.away
      expect(result.wentToExtraTime).toBe(levelAt90)
      if (levelAt90) {
        extraTimeSeen += 1
        expect(result.xgTimeline).toHaveLength(120)
        expect(result.events.some((e) => e.type === 'extra-time')).toBe(true)
        expect(result.events.at(-1)?.minute).toBe(120)
      } else {
        regulationSeen += 1
        expect(result.xgTimeline).toHaveLength(90)
        expect(result.events.some((e) => e.type === 'extra-time')).toBe(false)
        expect(result.shootout).toBeUndefined()
      }
    }
    // Both branches must actually be exercised for the assertions to mean anything.
    expect(extraTimeSeen).toBeGreaterThan(0)
    expect(regulationSeen).toBeGreaterThan(0)
  })

  it('always produces a winner', () => {
    let shootoutsSeen = 0
    for (let seed = 1; seed <= 150; seed += 1) {
      const result = simulateMatch(mirrorHome, mirrorAway, seed, { knockout: true })
      expect(result.winner === 'home' || result.winner === 'away').toBe(true)
      if (result.shootout) {
        shootoutsSeen += 1
        expect(result.finalScore.home).toBe(result.finalScore.away)
        expect(result.events.some((e) => e.type === 'penalties')).toBe(true)
      }
    }
    expect(shootoutsSeen).toBeGreaterThan(0)
  })

  it('goals scored in extra time count toward the final score', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = simulateMatch(mirrorHome, mirrorAway, seed, { knockout: true })
      if (!result.wentToExtraTime) continue
      const etGoals = result.events.filter((e) => e.type === 'goal' && e.minute > 90)
      const total = result.finalScore.home + result.finalScore.away
      const regulation = result.regulationScore.home + result.regulationScore.away
      expect(total).toBe(regulation + etGoals.length)
    }
  })
})

describe('simulateShootout', () => {
  const homeTakers = shootoutTakers(home.starters)
  const awayTakers = shootoutTakers(away.starters)

  it('orders takers best shooter first with the keeper last', () => {
    expect(homeTakers).toHaveLength(11)
    expect(homeTakers.at(-1)?.ratings.position).toBe('GK')
    for (let i = 1; i < homeTakers.length - 1; i += 1) {
      expect(homeTakers[i - 1].ratings.shooting).toBeGreaterThanOrEqual(homeTakers[i].ratings.shooting)
    }
  })

  it('always ends with a winner and a consistent tally', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const rng = createRng(seed)
      const result = simulateShootout(
        rng,
        { takers: homeTakers, goalkeeping: 70 },
        { takers: awayTakers, goalkeeping: 70 },
      )
      expect(result.score.home).not.toBe(result.score.away)
      expect(result.winner).toBe(result.score.home > result.score.away ? 'home' : 'away')

      const tally = { home: 0, away: 0 }
      for (const kick of result.kicks) {
        if (kick.scored) tally[kick.side] += 1
        expect(kick.scoreAfter).toEqual(tally)
        if (!kick.scored && kick.saved) expect(kick.dive).toBe(kick.direction)
      }
      expect(tally).toEqual(result.score)
      // A decision needs at least 3 kicks per side.
      expect(result.kicks.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('is deterministic for a given rng seed', () => {
    const a = simulateShootout(createRng(99), { takers: homeTakers, goalkeeping: 75 }, { takers: awayTakers, goalkeeping: 75 })
    const b = simulateShootout(createRng(99), { takers: homeTakers, goalkeeping: 75 }, { takers: awayTakers, goalkeeping: 75 })
    expect(b).toEqual(a)
  })
})
