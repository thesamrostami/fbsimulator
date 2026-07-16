import { describe, expect, it } from 'vitest'
import { computeSheetStrength, computeTeamStrength } from '../engine/ratings'
import { simulateMatch } from '../engine/simulate'
import { initialMatchState, matchAppReducer } from '../state/appState'
import {
  autoAssignFormation,
  FORMATIONS,
  formationOptions,
  formationSlots,
  PICKER_FORMATIONS,
  type FormationName,
} from './formations'
import { buildRealSheet, MATCHES, PLAYED_MATCHES, type PlayedMatch } from './matches'
import { getPlayer } from './players'

const ALL_FORMATIONS = Object.keys(FORMATIONS) as FormationName[]

describe('formation slots', () => {
  it.each(ALL_FORMATIONS.map((name) => [name] as const))('%s lays out 11 valid slots', (name) => {
    const slots = formationSlots(name)
    expect(slots).toHaveLength(11)
    expect(new Set(slots.map((s) => s.id)).size).toBe(11)
    expect(slots[0]).toMatchObject({ id: 'gk', line: 'GK' })
    expect(slots.filter((s) => s.line === 'GK')).toHaveLength(1)
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0)
      expect(slot.x).toBeLessThanOrEqual(100)
      expect(slot.y).toBeGreaterThanOrEqual(0)
      expect(slot.y).toBeLessThanOrEqual(100)
      expect(slot.label.length).toBeGreaterThan(0)
    }
    // Line counts match the name (e.g. "4-2-3-1" → 4 DEF, 5 MID, 1 FWD).
    const counts = name.split('-').map(Number)
    expect(slots.filter((s) => s.line === 'DEF')).toHaveLength(counts[0])
    expect(slots.filter((s) => s.line === 'FWD')).toHaveLength(counts[counts.length - 1])
  })

  it('offers the eight picker formations plus the real one when it is exotic', () => {
    expect(formationOptions('4-3-3')).toEqual(PICKER_FORMATIONS)
    expect(formationOptions('4-5-1')[0]).toBe('4-5-1')
    expect(formationOptions('4-5-1')).toHaveLength(9)
  })
})

describe('formation modifiers', () => {
  it('boosts Paraguay defence in their real 5-4-1 and France attack in their real 4-2-4', () => {
    const match = MATCHES['r16-1'] as PlayedMatch
    // Strip the results anchor: this test checks the player-aggregate path
    // (modifiers also flow through the anchor's reference, tested elsewhere).
    const par = { ...buildRealSheet(match.home), anchor: undefined }
    const fra = { ...buildRealSheet(match.away), anchor: undefined }

    const parBase = computeTeamStrength(par.starters)
    const parEffective = computeSheetStrength(par)
    expect(parEffective.defence).toBeCloseTo(parBase.defence * 1.1, 5)
    expect(parEffective.attack).toBeCloseTo(parBase.attack * 0.88, 5)

    const fraBase = computeTeamStrength(fra.starters)
    const fraEffective = computeSheetStrength(fra)
    expect(fraEffective.attack).toBeCloseTo(fraBase.attack * 1.08, 5)
    expect(fraEffective.midfield).toBeCloseTo(fraBase.midfield * 0.9, 5)
  })

  it('cites the shape in event reasoning when a modifier is in play', () => {
    const match = MATCHES['r16-1'] as PlayedMatch
    const result = simulateMatch(buildRealSheet(match.home), buildRealSheet(match.away), 7)
    const shots = result.events.filter((e) => e.type === 'goal' || e.type.startsWith('shot'))
    expect(shots.length).toBeGreaterThan(0)
    expect(shots.some((e) => /(4-2-4|5-4-1) shape/.test(e.reasoning ?? ''))).toBe(true)
  })

  it('keeps the 4-3-3 baseline neutral', () => {
    const m = FORMATIONS['4-3-3'].modifiers
    expect(m).toEqual({ attack: 1, midfield: 1, defence: 1, chanceQuality: 1 })
  })
})

describe('auto-assignment on formation change', () => {
  const sides = PLAYED_MATCHES.flatMap((match) => [match.home, match.away])

  it('fills every slot exactly once from every real XI into every formation', () => {
    for (const sideDef of sides) {
      const ordered = sideDef.starters.map((playerId) => ({
        playerId,
        natural: getPlayer(playerId).ratings.position,
      }))
      for (const target of ALL_FORMATIONS) {
        const assignment = autoAssignFormation(ordered, target)
        const slotIds = formationSlots(target).map((s) => s.id)
        expect(Object.keys(assignment).sort()).toEqual([...slotIds].sort())
        const players = Object.values(assignment)
        expect(players).toHaveLength(11)
        expect(new Set(players).size).toBe(11)
        // The natural keeper always keeps the gloves.
        expect(getPlayer(assignment.gk).ratings.position).toBe('GK')
      }
    }
  })

  it('re-flows through the reducer and resets back to the real shape', () => {
    const match = MATCHES['r16-4'] as PlayedMatch
    let state = initialMatchState(match)
    state = matchAppReducer(state, { type: 'formation', side: 'away', formation: '4-2-4' })

    expect(state.lineups.away.formation).toBe('4-2-4')
    const ids = Object.values(state.lineups.away.startersBySlot)
    expect(ids).toHaveLength(11)
    expect(new Set(ids).size).toBe(11)
    // England's natural forwards fill the four-man front line first.
    const fwdSlots = formationSlots('4-2-4').filter((s) => s.line === 'FWD')
    const fwdNaturals = fwdSlots.map(
      (slot) => getPlayer(state.lineups.away.startersBySlot[slot.id]).ratings.position,
    )
    expect(fwdNaturals.filter((p) => p === 'FWD')).toHaveLength(3) // Saka, Kane, Gordon

    state = matchAppReducer(state, { type: 'reset', side: 'away', sideDef: match.away })
    expect(state.lineups.away.formation).toBe(match.away.formation)
    expect(state.lineups.away.startersBySlot).toEqual(initialMatchState(match).lineups.away.startersBySlot)
  })
})
