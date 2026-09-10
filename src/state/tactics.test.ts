import { describe, expect, it } from 'vitest'
import { MATCHES, type PlayedMatch } from '../data/matches'
import { DEFAULT_TACTICS } from '../engine/tactics'
import { buildWhyThisResult, tacticsChangesBetween } from '../services/whyThisResult'
import { buildSheet, initialMatchState, makeHalftimeReducer, matchAppReducer, sameTactics } from './appState'

const match = MATCHES['r16-4'] as PlayedMatch

describe('tactics in the lineup state', () => {
  it('starts neutral and reaches the engine sheet', () => {
    const state = initialMatchState(match)
    expect(sameTactics(state.lineups.home.tactics, DEFAULT_TACTICS)).toBe(true)
    const sheet = buildSheet(match.home, state.lineups.home)
    expect(sheet.tactics).toEqual(DEFAULT_TACTICS)
  })

  it('changes one dial at a time and ignores no-op changes', () => {
    const state = initialMatchState(match)
    const next = matchAppReducer(state, { type: 'tactics', side: 'away', tactics: { pressing: 'high' } })
    expect(next.lineups.away.tactics).toEqual({ ...DEFAULT_TACTICS, pressing: 'high' })
    expect(next.lineups.home.tactics).toEqual(DEFAULT_TACTICS)
    expect(matchAppReducer(next, { type: 'tactics', side: 'away', tactics: { pressing: 'high' } })).toBe(next)
    const both = matchAppReducer(next, { type: 'tactics', side: 'away', tactics: { mentality: 'attacking' } })
    expect(both.lineups.away.tactics).toEqual({ mentality: 'attacking', pressing: 'high', width: 'normal' })
    expect(buildSheet(match.away, both.lineups.away).tactics).toEqual(both.lineups.away.tactics)
  })

  it('resets to neutral with the real lineup', () => {
    const edited = matchAppReducer(initialMatchState(match), { type: 'tactics', side: 'home', tactics: { width: 'wide' } })
    const reset = matchAppReducer(edited, { type: 'reset', side: 'home', sideDef: match.home })
    expect(reset.lineups.home.tactics).toEqual(DEFAULT_TACTICS)
  })

  it('is allowed at half-time without counting as a substitution, and resets to the first-half setting', () => {
    const firstHalf = initialMatchState(match).lineups
    const reducer = makeHalftimeReducer(firstHalf)
    const changed = reducer(firstHalf, { type: 'tactics', side: 'home', tactics: { mentality: 'defensive' } })
    expect(changed.home.tactics.mentality).toBe('defensive')
    expect(changed.home.startersBySlot).toEqual(firstHalf.home.startersBySlot)
    expect(reducer(changed, { type: 'reset', side: 'home', sideDef: match.home }).home.tactics).toEqual(DEFAULT_TACTICS)
  })
})

describe('tactics in the narrative', () => {
  it('counts an instruction change as an edit and names it', () => {
    const state = matchAppReducer(initialMatchState(match), {
      type: 'tactics',
      side: 'away',
      tactics: { mentality: 'attacking', pressing: 'high' },
    })
    const why = buildWhyThisResult(match, state.lineups)
    expect(why.edited).toBe(true)
    expect(why.shifts).toEqual([]) // instructions never move the phase ratings
    expect(why.tacticsChanges).toHaveLength(1)
    expect(why.tacticsChanges[0].team.id).toBe('ENG')
    expect(why.tacticsChanges[0].summary).toBe('attacking mentality, high press')
  })

  it('reports a return to neutral in words too', () => {
    const before = matchAppReducer(initialMatchState(match), { type: 'tactics', side: 'home', tactics: { width: 'narrow' } }).lineups
    const after = initialMatchState(match).lineups
    const changes = tacticsChangesBetween(match, before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0].summary).toMatch(/balanced/)
    expect(tacticsChangesBetween(match, after, after)).toEqual([])
  })
})
