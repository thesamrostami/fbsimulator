import { describe, expect, it } from 'vitest'
import { FORMATIONS, formationSlots, type FormationName } from '../data/formations'
import { MATCHES, type PlayedMatch } from '../data/matches'
import { PLAYERS } from '../data/players'
import { SQUADS } from '../data/squads'
import { createRng } from '../engine/rng'
import { computeTeamStrength } from '../engine/ratings'
import {
  buildSheet,
  initialMatchState,
  matchAppReducer,
  type ChipLocation,
  type MatchAppState,
  type SideKey,
} from './appState'

/**
 * Property-style regression for the formation/swap glitches: across every
 * formation and seeded random action sequences (swaps — including bench swaps
 * — interleaved with formation changes), the lineup invariants must always
 * hold. Guards against in-place mutation and stale-snapshot bugs.
 */

const ALL_FORMATIONS = Object.keys(FORMATIONS) as FormationName[]
const ACTIONS_PER_RUN = 30

function assertInvariants(state: MatchAppState, match: PlayedMatch, side: SideKey, step: string) {
  const lineup = state.lineups[side]
  const sideDef = match[side]
  const squadIds = new Set(SQUADS[sideDef.teamId].players)

  // Every current-formation slot filled, no extras, no duplicates.
  const slotIds = formationSlots(lineup.formation).map((s) => s.id)
  expect(Object.keys(lineup.startersBySlot).sort(), step).toEqual([...slotIds].sort())
  const onPitch = slotIds.map((id) => lineup.startersBySlot[id])
  expect(onPitch, step).toHaveLength(11)
  expect(new Set(onPitch).size, step).toBe(11)

  // Nobody on both pitch and bench; pitch ∪ bench = the full squad.
  const pitchSet = new Set(onPitch)
  for (const id of lineup.bench) expect(pitchSet.has(id), `${step}: ${id} on pitch AND bench`).toBe(false)
  const everyone = [...onPitch, ...lineup.bench]
  expect(new Set(everyone).size, step).toBe(everyone.length)
  expect(everyone.length, step).toBe(squadIds.size)
  for (const id of everyone) {
    expect(squadIds.has(id), `${step}: ${id} not in squad`).toBe(true)
    expect(PLAYERS[id], `${step}: unknown player ${id}`).toBeDefined()
  }

  // Sheet builds; out-of-position flags exactly match natural-line mismatches.
  const sheet = buildSheet(sideDef, lineup)
  const strength = computeTeamStrength(sheet.starters)
  const mismatches = sheet.starters.filter((a) => a.player.ratings.position !== a.slot.line)
  expect(strength.flags.length, step).toBe(mismatches.length)
  for (const value of [strength.attack, strength.midfield, strength.defence, strength.goalkeeping]) {
    expect(Number.isFinite(value), step).toBe(true)
  }
}

function randomLocation(rng: ReturnType<typeof createRng>, state: MatchAppState, side: SideKey): ChipLocation {
  const lineup = state.lineups[side]
  const slots = formationSlots(lineup.formation)
  const total = slots.length + lineup.bench.length
  const pick = Math.floor(rng.next() * total)
  return pick < slots.length
    ? { kind: 'slot', slotId: slots[pick].id }
    : { kind: 'bench', index: pick - slots.length }
}

// One 4-3-3 side and the two exotic real shapes.
const CASES: { matchId: string; side: SideKey }[] = [
  { matchId: 'r16-4', side: 'away' }, // England, 4-3-3
  { matchId: 'r16-2', side: 'home' }, // Canada, 5-1-4
  { matchId: 'r16-2', side: 'away' }, // Morocco, 4-5-1 (27-player squad)
]

describe('lineup invariants under random swaps and formation changes', () => {
  it.each(CASES.map((c) => [c.matchId, c.side, c] as const))(
    '%s %s survives seeded action sequences across all formations',
    (_id, _side, { matchId, side }) => {
      const match = MATCHES[matchId] as PlayedMatch
      for (const seed of [1, 2, 3]) {
        const rng = createRng(seed)
        let state = initialMatchState(match)
        for (let i = 0; i < ACTIONS_PER_RUN; i += 1) {
          if (rng.chance(0.35)) {
            const formation = ALL_FORMATIONS[Math.floor(rng.next() * ALL_FORMATIONS.length)]
            state = matchAppReducer(state, { type: 'formation', side, formation })
          } else {
            const a = randomLocation(rng, state, side)
            const b = randomLocation(rng, state, side)
            state = matchAppReducer(state, { type: 'swap', side, a, b })
          }
          assertInvariants(state, match, side, `seed ${seed} step ${i}`)
        }
        // Reset always restores the real lineup exactly.
        state = matchAppReducer(state, { type: 'reset', side, sideDef: match[side] })
        expect(state.lineups[side]).toEqual(initialMatchState(match).lineups[side])
      }
    },
  )

  it('visits every formation explicitly, in and out, after a bench swap', () => {
    const match = MATCHES['r16-4'] as PlayedMatch
    let state = initialMatchState(match)
    // Bench swap first: Vargas (bench) in for Jimenez (ST slot f2).
    const benchIndex = state.lineups.home.bench.indexOf('mex-vargas')
    state = matchAppReducer(state, {
      type: 'swap',
      side: 'home',
      a: { kind: 'bench', index: benchIndex },
      b: { kind: 'slot', slotId: 'f2' },
    })
    for (const formation of ALL_FORMATIONS) {
      state = matchAppReducer(state, { type: 'formation', side: 'home', formation })
      assertInvariants(state, match, 'home', `into ${formation}`)
      // The swapped-in bench player stays on the pitch through every re-flow.
      expect(Object.values(state.lineups.home.startersBySlot)).toContain('mex-vargas')
      state = matchAppReducer(state, { type: 'formation', side: 'home', formation: '4-3-3' })
      assertInvariants(state, match, 'home', `out of ${formation}`)
    }
  })
})
