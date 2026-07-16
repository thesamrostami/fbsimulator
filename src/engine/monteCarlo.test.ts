import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { getPlayer } from '../data/players'
import { runMonteCarlo } from './monteCarlo'
import type { TeamSheet } from './types'

const mexEng = MATCHES['r16-4'] as PlayedMatch
const home = buildRealSheet(mexEng.home)
const away = buildRealSheet(mexEng.away)

describe('runMonteCarlo', () => {
  const result = runMonteCarlo(home, away, 1000, 20260706)

  it('is reproducible for the same base seed', () => {
    const again = runMonteCarlo(home, away, 1000, 20260706)
    expect(again).toEqual(result)
  })

  it('produces a sane distribution with the real lineups', () => {
    expect(result.homeWinPct + result.drawPct + result.awayWinPct).toBeCloseTo(100, 0)

    // England won the real match and are the stronger squad: clear favourites.
    expect(result.awayWinPct).toBeGreaterThan(result.homeWinPct + 5)
    // But Mexico's shot volume means they win a meaningful share of replays.
    expect(result.homeWinPct).toBeGreaterThanOrEqual(15)
    expect(result.drawPct).toBeGreaterThan(10)

    const totalAvgGoals = result.avgGoals.home + result.avgGoals.away
    expect(totalAvgGoals).toBeGreaterThan(1.5)
    expect(totalAvgGoals).toBeLessThan(4.5)

    expect(result.topScorelines.length).toBeGreaterThan(3)
    expect(result.topScorelines[0].count).toBeGreaterThanOrEqual(result.topScorelines[1].count)
  })

  it('weakens England when Kane keeps goal and Pickford leads the line', () => {
    const sabotaged: TeamSheet = {
      ...away,
      starters: away.starters.map((assignment) => {
        if (assignment.slot.id === 'gk') return { slot: assignment.slot, player: getPlayer('eng-kane') }
        if (assignment.slot.id === 'f2') return { slot: assignment.slot, player: getPlayer('eng-pickford') }
        return assignment
      }),
    }
    const worse = runMonteCarlo(home, sabotaged, 1000, 20260706)
    expect(worse.awayWinPct).toBeLessThan(result.awayWinPct - 10)
  })

  it('decides every knockout replay and reports ET/shootout shares', () => {
    const knockout = runMonteCarlo(home, away, 400, 20260706, { knockout: true })
    expect(knockout.drawPct).toBe(0)
    expect(knockout.homeWinPct + knockout.awayWinPct).toBeCloseTo(100, 0)
    expect(knockout.extraTimePct).toBeGreaterThan(0)
    expect(knockout.shootoutPct).toBeDefined()
    expect(knockout.shootoutPct!).toBeLessThanOrEqual(knockout.extraTimePct!)
  })
})
