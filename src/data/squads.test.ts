import { describe, expect, it } from 'vitest'
import { benchFor, realLineupState } from '../state/appState'
import { PLAYED_MATCHES } from './matches'
import { PLAYERS } from './players'
import { SQUADS } from './squads'
import { TEAMS, type TeamId } from './teams'

const LINE_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const

describe('squad data integrity', () => {
  const squadEntries = Object.entries(SQUADS) as [TeamId, (typeof SQUADS)[TeamId]][]

  it('covers all 16 teams with 26-player squads (27 for Morocco, incl. featured Sbai)', () => {
    expect(squadEntries).toHaveLength(16)
    for (const [teamId, squad] of squadEntries) {
      expect(TEAMS[teamId]).toBeDefined()
      expect(squad.teamId).toBe(teamId)
      expect(squad.players.length).toBe(teamId === 'MAR' ? 27 : 26)
    }
  })

  it.each(squadEntries.map(([id, squad]) => [id, squad] as const))(
    '%s squad has no duplicates, valid players, and GK→DEF→MID→FWD order',
    (teamId, squad) => {
      expect(new Set(squad.players).size).toBe(squad.players.length)
      expect(squad.verified).toBe(true)
      expect(squad.sources.length).toBeGreaterThanOrEqual(2)

      let lastLine = 0
      for (const id of squad.players) {
        const player = PLAYERS[id]
        expect(player, `player ${id}`).toBeDefined()
        expect(id.startsWith(`${teamId.toLowerCase()}-`), `${id} belongs to ${teamId}`).toBe(true)
        const { pace, shooting, passing, defending, physical, position } = player.ratings
        for (const value of [pace, shooting, passing, defending, physical]) {
          expect(value).toBeGreaterThan(0)
          expect(value).toBeLessThanOrEqual(99)
        }
        const line = LINE_ORDER[position]
        expect(line, `${id} keeps ${teamId} grouped by position`).toBeGreaterThanOrEqual(lastLine)
        lastLine = line
      }
    },
  )

  it('contains every player who featured in a knockout match', () => {
    for (const match of PLAYED_MATCHES) {
      for (const sideDef of [match.home, match.away]) {
        const squad = SQUADS[sideDef.teamId]
        for (const id of [...sideDef.starters, ...sideDef.bench]) {
          expect(squad.players, `${id} in ${sideDef.teamId} squad`).toContain(id)
        }
      }
    }
  })

  it('builds full benches: squad minus the XI, no overlap, no duplicates', () => {
    for (const match of PLAYED_MATCHES) {
      for (const sideDef of [match.home, match.away]) {
        const bench = benchFor(sideDef)
        const squad = SQUADS[sideDef.teamId]
        expect(bench).toHaveLength(squad.players.length - 11)
        expect(new Set(bench).size).toBe(bench.length)
        for (const id of sideDef.starters) expect(bench).not.toContain(id)

        const lineup = realLineupState(sideDef)
        expect(lineup.bench).toEqual(bench)
        expect(Object.values(lineup.startersBySlot)).toHaveLength(11)
      }
    }
  })
})
