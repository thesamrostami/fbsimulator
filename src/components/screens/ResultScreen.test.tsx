// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>()
  return { ...mod, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> }
})
// The 3D replay mounts a WebGL canvas jsdom can't run.
vi.mock('../match/MomentumTerrain', () => ({ MomentumTerrain: () => null }))
vi.mock('../match/LivePitch', () => ({ LivePitch: () => null }))
import { MemoryRouter } from 'react-router-dom'
import { buildRealSheet, MATCHES, type PlayedMatch } from '../../data/matches'
import { runMonteCarlo } from '../../engine/monteCarlo'
import { simulateMatch } from '../../engine/simulate'
import { isShotEvent, type SimResult } from '../../engine/types'
import { matchSimOptions } from '../../services/simulation'
import { initialMatchState } from '../../state/appState'
import { ResultScreen } from './ResultScreen'

beforeAll(() => {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList) as typeof window.matchMedia
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

const match = MATCHES['r16-1'] as PlayedMatch
const home = buildRealSheet(match.home)
const away = buildRealSheet(match.away)
const options = matchSimOptions(match)

/** A sim with the richest event mix: a penalty, a blocked shot and a corner. */
function richSim(): SimResult {
  for (let seed = 1; seed < 400; seed++) {
    const sim = simulateMatch(home, away, seed, options)
    const has = (type: string) => sim.events.some((e) => e.type === type)
    if (has('penalty') && has('shot-blocked') && has('corner') && has('goal')) return sim
  }
  throw new Error('no seed produced a penalty, a block and a corner')
}

describe('ResultScreen on the possession engine', () => {
  it('renders the scoreline, the insight and a match report that carries the new event types', () => {
    const sim = richSim()
    const monteCarlo = runMonteCarlo(home, away, 50, 1, options)
    render(
      <MemoryRouter>
        <ResultScreen
          match={match}
          sim={sim}
          monteCarlo={monteCarlo}
          lineups={initialMatchState(match).lineups}
          onEdit={() => {}}
          onRerun={() => {}}
          rerunning={false}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('How it played out')).toBeTruthy()
    expect(screen.getByText(/Goals in your replay/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /match report/i }))
    const penalty = sim.events.find((e) => e.type === 'penalty')!
    expect(screen.getByText(penalty.commentary)).toBeTruthy()
    // Every goal line is in the report, and its numbers are one tap away.
    for (const goal of sim.events.filter((e) => e.type === 'goal')) {
      const card = screen.getByText(goal.commentary)
      fireEvent.click(card.closest('button')!)
      expect(screen.getByText(goal.reasoning!)).toBeTruthy()
    }
    // Big chances survive the filter; routine blocked shots do not.
    const bigBlocked = sim.events.filter((e) => e.type === 'shot-blocked' && (e.xg ?? 0) >= 0.2)
    for (const e of bigBlocked) expect(screen.getByText(e.commentary)).toBeTruthy()
    const smallShots = sim.events.filter((e) => isShotEvent(e) && e.type !== 'goal' && (e.xg ?? 0) < 0.2)
    expect(smallShots.length).toBeGreaterThan(0)
    expect(screen.queryByText(smallShots[0].commentary)).toBeNull()
  })
})

describe('ResultScreen analysis', () => {
  it('shows the man of the match at a glance and the full analysis tab: stats, shot map, ratings', () => {
    const sim = richSim()
    const monteCarlo = runMonteCarlo(home, away, 50, 1, options)
    render(
      <MemoryRouter>
        <ResultScreen
          match={match}
          sim={sim}
          monteCarlo={monteCarlo}
          lineups={initialMatchState(match).lineups}
          onEdit={() => {}}
          onRerun={() => {}}
          rerunning={false}
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('motm')).toBeTruthy()
    expect(screen.getAllByText(/Man of the match/i).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('tab', { name: /analysis/i }))
    expect(screen.getByText('Match stats')).toBeTruthy()
    expect(screen.getByText('Progressive passes')).toBeTruthy()
    const shots = sim.events.filter((e) => e.type === 'goal' || e.type.startsWith('shot')).length
    expect(screen.getByRole('img', { name: `Shot map: ${shots} attempts` })).toBeTruthy()
    const table = screen.getByTestId('ratings-table')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(11)
    expect(screen.getAllByText(/MOTM/).length).toBeGreaterThanOrEqual(1)
  })
})
