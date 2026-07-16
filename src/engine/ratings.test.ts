import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { getPlayer } from '../data/players'
import { computeTeamStrength, effectiveRatings, positionPenalty } from './ratings'
import type { SlotAssignment } from './types'

const mexEng = MATCHES['r16-4'] as PlayedMatch

describe('positionPenalty', () => {
  it('applies no penalty in the natural line', () => {
    expect(positionPenalty('FWD', 'FWD')).toBe(1)
    expect(positionPenalty('GK', 'GK')).toBe(1)
  })

  it('penalises adjacent-line moves moderately', () => {
    expect(positionPenalty('FWD', 'MID')).toBe(0.75)
    expect(positionPenalty('DEF', 'MID')).toBe(0.75)
  })

  it('penalises a striker in defence heavily', () => {
    expect(positionPenalty('FWD', 'DEF')).toBe(0.6)
    expect(positionPenalty('DEF', 'FWD')).toBe(0.6)
  })

  it('makes goalkeepers and outfielders nearly unusable when swapped', () => {
    expect(positionPenalty('GK', 'MID')).toBe(0.4)
    expect(positionPenalty('FWD', 'GK')).toBe(0.4)
  })
})

describe('effectiveRatings', () => {
  it("scales a striker's defending contribution down out of position", () => {
    const kane = getPlayer('eng-kane')
    const inDefence = effectiveRatings(kane.ratings, 'DEF')
    expect(inDefence.penalty).toBe(0.6)
    expect(inDefence.defending).toBeCloseTo(kane.ratings.defending * 0.6)
    expect(inDefence.shooting).toBeCloseTo(kane.ratings.shooting * 0.6)
  })

  it('leaves ratings untouched in the natural line', () => {
    const kane = getPlayer('eng-kane')
    const upFront = effectiveRatings(kane.ratings, 'FWD')
    expect(upFront.shooting).toBe(kane.ratings.shooting)
    expect(upFront.penalty).toBe(1)
  })
})

describe('computeTeamStrength', () => {
  const realSheet = buildRealSheet(mexEng.away)

  it('reports no out-of-position flags for the real lineup', () => {
    const strength = computeTeamStrength(realSheet.starters)
    expect(strength.flags).toHaveLength(0)
    expect(strength.attack).toBeGreaterThan(60)
    expect(strength.defence).toBeGreaterThan(60)
  })

  it('drops team strength and raises flags when players are shuffled out of position', () => {
    const real = computeTeamStrength(realSheet.starters)

    // Swap Kane (ST, slot f2) with Guéhi (CB, slot d3).
    const shuffled: SlotAssignment[] = realSheet.starters.map((assignment) => {
      if (assignment.slot.id === 'f2') return { slot: assignment.slot, player: getPlayer('eng-guehi') }
      if (assignment.slot.id === 'd3') return { slot: assignment.slot, player: getPlayer('eng-kane') }
      return assignment
    })
    const strength = computeTeamStrength(shuffled)

    expect(strength.attack).toBeLessThan(real.attack)
    expect(strength.defence).toBeLessThan(real.defence)
    expect(strength.flags).toHaveLength(2)
    const kaneFlag = strength.flags.find((f) => f.playerId === 'eng-kane')
    expect(kaneFlag?.penalty).toBe(0.6)
    expect(kaneFlag?.slotLine).toBe('DEF')
  })

  it('punishes an outfielder in goal via the goalkeeping rating', () => {
    const real = computeTeamStrength(realSheet.starters)
    const kaneInGoal: SlotAssignment[] = realSheet.starters.map((assignment) => {
      if (assignment.slot.id === 'gk') return { slot: assignment.slot, player: getPlayer('eng-kane') }
      if (assignment.slot.id === 'f2') return { slot: assignment.slot, player: getPlayer('eng-pickford') }
      return assignment
    })
    const strength = computeTeamStrength(kaneInGoal)
    expect(strength.goalkeeping).toBeLessThan(real.goalkeeping * 0.6)
  })
})
