import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../engine/simulate'
import { BRACKET_ROUNDS, buildRealSheet, formationSlots, MATCHES, PLAYED_MATCHES } from './matches'
import { PLAYERS } from './players'
import { TEAMS } from './teams'

describe('match data', () => {
  it('covers all 16 knockout matches as played, with none left locked', () => {
    expect(PLAYED_MATCHES).toHaveLength(16)
    const locked = Object.values(MATCHES).filter((m) => !m.played)
    expect(locked).toHaveLength(0)
    // The third-place play-off sits outside the round-based bracket path.
    const bracketIds = BRACKET_ROUNDS.flatMap((round) => round.matchIds)
    expect(bracketIds).not.toContain('third-place')
    expect([...bracketIds, 'third-place'].sort()).toEqual(Object.keys(MATCHES).sort())
    // The third-place play-off has been played, still tagged as a secondary node.
    const thirdPlace = MATCHES['third-place']
    expect(thirdPlace.played).toBe(true)
    expect(thirdPlace.played && thirdPlace.type).toBe('third-place')
    // The final is played and tagged as the title decider.
    const final = MATCHES['final']
    expect(final.played).toBe(true)
    expect(final.played && final.type).toBe('final')
  })

  it.each(PLAYED_MATCHES.map((match) => [match.id, match] as const))(
    '%s builds valid real lineups',
    (_id, match) => {
      for (const sideDef of [match.home, match.away]) {
        expect(sideDef.starters).toHaveLength(11)
        expect(sideDef.bench.length).toBeGreaterThanOrEqual(4)

        const ids = [...sideDef.starters, ...sideDef.bench]
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of ids) expect(PLAYERS[id], `player ${id}`).toBeDefined()

        const slots = formationSlots(sideDef.formation)
        expect(slots).toHaveLength(11)

        const sheet = buildRealSheet(sideDef)
        // Real lineups are the reference point: nobody starts out of position.
        for (const { slot, player } of sheet.starters) {
          expect(player.ratings.position, `${player.id} in ${slot.id}`).toBe(slot.line)
        }
        expect(TEAMS[sideDef.teamId]).toBeDefined()
      }

      expect(match.real.possession.home + match.real.possession.away).toBe(100)
      const goalCount = { home: 0, away: 0 }
      for (const goal of match.real.goals) {
        if (goal.teamId === match.home.teamId) goalCount.home += 1
        else if (goal.teamId === match.away.teamId) goalCount.away += 1
        else throw new Error(`goal team ${goal.teamId} not in match ${match.id}`)
      }
      expect(goalCount).toEqual(match.real.score)
    },
  )

  it.each(PLAYED_MATCHES.map((match) => [match.id, match] as const))(
    '%s simulates in knockout mode without errors',
    (_id, match) => {
      const home = buildRealSheet(match.home)
      const away = buildRealSheet(match.away)
      const result = simulateMatch(home, away, 20260704, {
        knockout: true,
        homePossession: match.real.possession.home / 100,
      })
      expect(result.winner === 'home' || result.winner === 'away').toBe(true)
      expect(result.events[0]?.type).toBe('kickoff')
      expect(result.events.at(-1)?.type).toBe('full-time')
    },
  )
})
