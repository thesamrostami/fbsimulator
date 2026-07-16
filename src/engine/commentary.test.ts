import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../data/matches'
import { ALL_TAGS, createCommentator, poolSize, type CommentaryType } from './commentary'
import { createRng } from './rng'
import { simulateMatch } from './simulate'

const mexEng = MATCHES['r16-4'] as PlayedMatch

describe('commentator variant selection', () => {
  it('never repeats a variant until the pool is exhausted', () => {
    for (const type of ['goal', 'shot-miss', 'shot-saved', 'yellow-card', 'pen-scored'] as CommentaryType[]) {
      // With every tag active the whole pool is eligible.
      const commentator = createCommentator(createRng(7))
      const size = poolSize(type, ALL_TAGS)
      const seen = new Set<string>()
      for (let i = 0; i < size; i += 1) {
        seen.add(
          commentator.line(type, {
            player: 'Kane',
            team: 'England',
            opponent: 'Mexico',
            xg: 0.31,
            odds: 0.78,
            score: '1–0',
            tags: ALL_TAGS,
          }),
        )
      }
      expect(seen.size, type).toBe(size)
    }
  })

  it('never serves a tagged variant to an event without that context', () => {
    // Exhaust the generic shot-miss pool twice over: no out-of-position or
    // star lines may ever appear for a plain, untagged shot.
    const commentator = createCommentator(createRng(5))
    for (let i = 0; i < poolSize('shot-miss') * 2; i += 1) {
      const line = commentator.line('shot-miss', { player: 'Romo', xg: 0.1 })
      expect(line).not.toMatch(/strange role|superstar is human/i)
    }
  })

  it('is deterministic for a given rng seed', () => {
    const a = createCommentator(createRng(11))
    const b = createCommentator(createRng(11))
    for (let i = 0; i < 10; i += 1) {
      expect(a.line('goal', { player: 'X', tags: ['equalizer'], score: '1–1' })).toBe(
        b.line('goal', { player: 'X', tags: ['equalizer'], score: '1–1' }),
      )
    }
  })

  it('prefers tag-matching variants: equalizers sound like equalizers', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const line = createCommentator(createRng(seed)).line('goal', {
        player: 'Kane',
        team: 'England',
        score: '1–1',
        tags: ['equalizer'],
      })
      expect(line, `seed ${seed}`).toMatch(/LEVELS IT|All square|equalizer arrives/)
    }
  })

  it('pressure kicks draw from the pressure pool', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const line = createCommentator(createRng(seed)).line('pen-scored', {
        player: 'Messi',
        odds: 0.81,
        tags: ['pressure'],
      })
      expect(line, `seed ${seed}`).toMatch(/pressure|must-score|Must-score|shootout|Ice|alive|Everything on this kick/i)
    }
  })

  it('weaves real numbers into lines', () => {
    const commentator = createCommentator(createRng(3))
    const lines: string[] = []
    for (let i = 0; i < poolSize('goal'); i += 1) {
      lines.push(commentator.line('goal', { player: 'Yamal', team: 'Spain', xg: 0.31, score: '2–1' }))
    }
    expect(lines.some((l) => l.includes('0.31'))).toBe(true)
    expect(lines.some((l) => l.includes('2–1'))).toBe(true)
  })

  it('never repeats within one simulated match (per event type, up to pool size)', () => {
    const sim = simulateMatch(buildRealSheet(mexEng.home), buildRealSheet(mexEng.away), 42, {
      knockout: true,
      homePossession: 0.66,
    })
    const byType = new Map<string, string[]>()
    for (const event of sim.events) {
      byType.set(event.type, [...(byType.get(event.type) ?? []), event.commentary])
    }
    for (const [type, lines] of byType) {
      const window = lines.slice(0, poolSize(type as CommentaryType))
      expect(new Set(window).size, type).toBe(window.length)
    }
  })
})
