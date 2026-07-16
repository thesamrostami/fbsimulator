import { describe, expect, it } from 'vitest'
import { MATCHES, type PlayedMatch } from '../data/matches'
import { initialMatchState, matchAppReducer } from '../state/appState'
import { buildWhyThisResult } from './whyThisResult'

const match = MATCHES['r16-4'] as PlayedMatch

describe('buildWhyThisResult', () => {
  it('reports untouched real lineups with all four phase gaps', () => {
    const { lineups } = initialMatchState(match)
    const why = buildWhyThisResult(match, lineups)

    expect(why.edited).toBe(false)
    expect(why.shifts).toHaveLength(0)
    expect(why.outOfPosition).toHaveLength(0)
    expect(why.gaps).toHaveLength(4)
    // Sorted biggest gap first.
    for (let i = 1; i < why.gaps.length; i += 1) {
      expect(Math.abs(why.gaps[i - 1].gap)).toBeGreaterThanOrEqual(Math.abs(why.gaps[i].gap))
    }
    expect(why.possession).toEqual({ home: 66, away: 34 })
  })

  it('detects edits and phase shifts when a key player is benched', () => {
    // Bench Kane (ST, slot f2) for bench seat 0 — the first backup keeper in squad order.
    const state = matchAppReducer(initialMatchState(match), {
      type: 'swap',
      side: 'away',
      a: { kind: 'slot', slotId: 'f2' },
      b: { kind: 'bench', index: 0 },
    })
    const why = buildWhyThisResult(match, state.lineups)

    expect(why.edited).toBe(true)
    const attackShift = why.shifts.find((s) => s.team.id === 'ENG' && s.phase === 'attack')
    expect(attackShift).toBeDefined()
    expect(attackShift!.after).toBeLessThan(attackShift!.before)
    // A keeper up front is flagged out of position.
    expect(why.outOfPosition.some((side) => side.team.id === 'ENG')).toBe(true)
  })

  it('reports a formation switch with the shape modifiers applied', () => {
    const state = matchAppReducer(initialMatchState(match), {
      type: 'formation',
      side: 'away',
      formation: '4-2-4',
    })
    const why = buildWhyThisResult(match, state.lineups)

    expect(why.edited).toBe(true)
    expect(why.formationChanges).toHaveLength(1)
    expect(why.formationChanges[0]).toMatchObject({ from: '4-3-3', to: '4-2-4' })
    expect(why.formationChanges[0].team.id).toBe('ENG')
    // 4-2-4 modifiers show up as phase shifts vs the real 4-3-3.
    const midShift = why.shifts.find((s) => s.team.id === 'ENG' && s.phase === 'midfield')
    expect(midShift).toBeDefined()
    expect(midShift!.after).toBeLessThan(midShift!.before)
  })

  it('flags edits even when the swap moves no phase rating', () => {
    // Vargas for Jimenez: both natural FWDs with near-identical aggregate ratings.
    const state = matchAppReducer(initialMatchState(match), {
      type: 'swap',
      side: 'home',
      a: { kind: 'slot', slotId: 'f2' },
      b: { kind: 'bench', index: 2 },
    })
    const why = buildWhyThisResult(match, state.lineups)
    expect(why.edited).toBe(true)
  })
})
