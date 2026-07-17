import { describe, expect, it } from 'vitest'
import { formationSlots } from '../data/formations'
import { MATCHES, type PlayedMatch } from '../data/matches'
import {
  countPersonnelChanges,
  initialMatchState,
  makeHalftimeReducer,
  matchAppReducer,
  MAX_HALFTIME_SUBS,
  type LineupState,
  type SideKey,
} from './appState'

const match = MATCHES['r16-4'] as PlayedMatch
const firstHalf = initialMatchState(match).lineups

const startersOf = (lineups: Record<SideKey, LineupState>, side: SideKey) =>
  lineups[side].startersBySlot

describe('countPersonnelChanges', () => {
  it('is zero for the unchanged XI', () => {
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(firstHalf, 'away'))).toBe(0)
  })

  it('counts a formation-only reshuffle of the same 11 as zero', () => {
    const reducer = makeHalftimeReducer(firstHalf)
    let lineups = reducer(firstHalf, { type: 'formation', side: 'away', formation: '4-4-2' })
    expect(lineups.away.formation).toBe('4-4-2')
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(lineups, 'away'))).toBe(0)

    // Positional swaps inside the XI aren't personnel changes either.
    lineups = reducer(lineups, {
      type: 'swap',
      side: 'away',
      a: { kind: 'slot', slotId: 'f1' },
      b: { kind: 'slot', slotId: 'f2' },
    })
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(lineups, 'away'))).toBe(0)
  })

  it('counts each fresh player once, and swapping him back out reverts the count', () => {
    const reducer = makeHalftimeReducer(firstHalf)
    const benchId = firstHalf.away.bench[1]
    const swapIn = {
      type: 'swap' as const,
      side: 'away' as const,
      a: { kind: 'bench' as const, index: 1 },
      b: { kind: 'slot' as const, slotId: 'f2' },
    }
    let lineups = reducer(firstHalf, swapIn)
    expect(startersOf(lineups, 'away').f2).toBe(benchId)
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(lineups, 'away'))).toBe(1)
    // The starter came out to bench seat 1 — swap the pair straight back.
    lineups = reducer(lineups, swapIn)
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(lineups, 'away'))).toBe(0)
  })
})

describe('makeHalftimeReducer substitution cap', () => {
  const reducer = makeHalftimeReducer(firstHalf)
  const originalXI = new Set(Object.values(firstHalf.away.startersBySlot))

  function makeFiveSubs() {
    const newcomers = firstHalf.away.bench.filter((id) => !originalXI.has(id))
    expect(newcomers.length).toBeGreaterThanOrEqual(MAX_HALFTIME_SUBS + 1)
    const outfieldSlots = formationSlots(firstHalf.away.formation)
      .filter((slot) => slot.line !== 'GK')
      .map((slot) => slot.id)
    let lineups = firstHalf
    for (let i = 0; i < MAX_HALFTIME_SUBS; i += 1) {
      lineups = reducer(lineups, {
        type: 'swap',
        side: 'away',
        a: { kind: 'bench', index: lineups.away.bench.indexOf(newcomers[i]) },
        b: { kind: 'slot', slotId: outfieldSlots[i] },
      })
    }
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(lineups, 'away'))).toBe(
      MAX_HALFTIME_SUBS,
    )
    return { lineups, newcomers, outfieldSlots }
  }

  it('rejects the sixth fresh player outright — the state does not change', () => {
    const { lineups, newcomers, outfieldSlots } = makeFiveSubs()
    const blocked = reducer(lineups, {
      type: 'swap',
      side: 'away',
      a: { kind: 'bench', index: lineups.away.bench.indexOf(newcomers[MAX_HALFTIME_SUBS]) },
      b: { kind: 'slot', slotId: outfieldSlots[MAX_HALFTIME_SUBS] },
    })
    expect(blocked).toBe(lineups)
  })

  it('still allows formation changes, XI reshuffles and undo-subs at the cap', () => {
    const { lineups } = makeFiveSubs()

    const reshaped = reducer(lineups, { type: 'formation', side: 'away', formation: '3-5-2' })
    expect(reshaped.away.formation).toBe('3-5-2')
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(reshaped, 'away'))).toBe(
      MAX_HALFTIME_SUBS,
    )

    // Undo one sub: a first-half starter (now benched) comes back for a newcomer.
    const benchedStarter = lineups.away.bench.find((id) => originalXI.has(id))!
    const newcomerSlot = Object.entries(startersOf(lineups, 'away')).find(
      ([, id]) => !originalXI.has(id),
    )![0]
    const undone = reducer(lineups, {
      type: 'swap',
      side: 'away',
      a: { kind: 'bench', index: lineups.away.bench.indexOf(benchedStarter) },
      b: { kind: 'slot', slotId: newcomerSlot },
    })
    expect(countPersonnelChanges(startersOf(firstHalf, 'away'), startersOf(undone, 'away'))).toBe(
      MAX_HALFTIME_SUBS - 1,
    )
  })

  it("resets to the first half's XI, not the real one", () => {
    // A pre-match edit means the first-half XI differs from the real lineup.
    const editedKickoff = matchAppReducer(initialMatchState(match), {
      type: 'swap',
      side: 'away',
      a: { kind: 'slot', slotId: 'f2' },
      b: { kind: 'bench', index: 1 },
    }).lineups
    const halftimeReducer = makeHalftimeReducer(editedKickoff)
    let lineups = halftimeReducer(editedKickoff, {
      type: 'swap',
      side: 'away',
      a: { kind: 'bench', index: 2 },
      b: { kind: 'slot', slotId: 'm1' },
    })
    expect(lineups.away).not.toEqual(editedKickoff.away)
    lineups = halftimeReducer(lineups, { type: 'reset', side: 'away', sideDef: match.away })
    expect(lineups.away).toEqual(editedKickoff.away)
    expect(lineups.away).not.toEqual(firstHalf.away)
  })
})
