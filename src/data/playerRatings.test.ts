import { describe, expect, it } from 'vitest'
// The matching helpers are plain ESM shared with the pipeline.
import { fc26Line, jaroWinkler, normalizeName, scoreCandidate } from '../../pipeline/lib/match-names.mjs'
import generated from './generated/player_ratings.json'
import { fc26Info, PLAYERS, ratingSource } from './players'

describe('name normalization and matching', () => {
  it('strips diacritics, punctuation, and non-Latin script', () => {
    expect(normalizeName('Émiliano Martínez')).toBe('emiliano martinez')
    expect(normalizeName("N'Golo Kanté")).toBe('n golo kante')
    expect(normalizeName('Møller Wolfe')).toBe('mller wolfe') // ø is a letter, not a diacritic — dropped, not folded
    expect(normalizeName('Brahim Díazابراهيم عبد القادر')).toBe('brahim diaz')
    expect(normalizeName('E. Martínez')).toBe('e martinez')
  })

  it('matches short forms against full names', () => {
    expect(
      scoreCandidate('E. Martínez', 'E. Martínez', 'Damián Emiliano Martínez Romero'),
    ).toBeGreaterThanOrEqual(0.95)
    expect(scoreCandidate('Kane', 'H. Kane', 'Harry Edward Kane')).toBeGreaterThanOrEqual(0.99)
    expect(scoreCandidate('Bruno Fernandes', 'Bruno Fernandes', 'Bruno Miguel Borges Fernandes')).toBeGreaterThanOrEqual(0.99)
  })

  it("an initial can never be satisfied by the surname token itself", () => {
    // 'G.' must match a token other than 'Gómez' — Diego Gómez is not G. Gómez.
    expect(scoreCandidate('G. Gómez', 'D. Gómez', 'Diego Alexander Gómez Amarilla')).toBe(0)
    expect(scoreCandidate('D. Gómez', 'D. Gómez', 'Diego Alexander Gómez Amarilla')).toBeGreaterThan(0.9)
  })

  it('rejects unrelated names and maps positions to lines', () => {
    expect(scoreCandidate('Neymar', 'A. Jones', 'Alfie Mark Jones')).toBe(0)
    expect(jaroWinkler('kane', 'kane')).toBe(1)
    expect(fc26Line('GK')).toBe('GK')
    expect(fc26Line('CB, RB')).toBe('DEF')
    expect(fc26Line('ST')).toBe('FWD')
  })
})

describe('generated player_ratings.json', () => {
  it('carries provenance and plausible match volume', () => {
    expect(generated.meta.source).toContain('FC 26')
    expect(generated.meta.attribution).toContain('Kaggle')
    expect(generated.meta.matched).toBe(Object.keys(generated.players).length)
    expect(generated.meta.matched).toBeGreaterThan(300)
    expect(generated.meta.matched + generated.meta.unmatched).toBe(generated.meta.rosterSize)
  })

  it('only references known players with in-range ratings', () => {
    for (const [id, entry] of Object.entries(generated.players)) {
      expect(PLAYERS[id], id).toBeDefined()
      for (const key of ['pace', 'shooting', 'passing', 'defending', 'physical'] as const) {
        expect(entry[key], `${id}.${key}`).toBeGreaterThanOrEqual(1)
        expect(entry[key], `${id}.${key}`).toBeLessThanOrEqual(99)
      }
      expect(entry.source).toBe('fc26')
    }
  })

  it('applies FC 26 ratings without touching our positions', () => {
    expect(ratingSource('eng-kane')).toBe('fc26')
    expect(PLAYERS['eng-kane'].ratings.shooting).toBe(generated.players['eng-kane'].shooting)
    expect(PLAYERS['eng-kane'].ratings.position).toBe('FWD')
    expect(fc26Info('eng-kane')?.fc26Name).toContain('Kane')
    // Unmatched players keep the estimate and say so.
    const unmatchedId = Object.keys(PLAYERS).find((id) => !(id in generated.players))!
    expect(ratingSource(unmatchedId)).toBe('estimate')
    expect(fc26Info(unmatchedId)).toBeNull()
  })
})
