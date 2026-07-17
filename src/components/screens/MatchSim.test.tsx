// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// AnimatePresence exit animations don't run under jsdom + fake timers, which
// would keep exiting children mounted forever and mask the state under test.
// A passthrough makes unmounts immediate; the browser keeps the real fade.
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>()
  return { ...mod, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> }
})
import { buildRealSheet, MATCHES, type PlayedMatch } from '../../data/matches'
import { TEAMS } from '../../data/teams'
import { playFirstHalf, resumeMatch, type HalftimeState } from '../../engine/simulate'
import type { SimResult } from '../../engine/types'
import { matchSimOptions } from '../../services/simulation'
import { initialMatchState } from '../../state/appState'
import { MatchSim } from './MatchSim'

// jsdom lacks the browser APIs framer-motion probes for.
beforeAll(() => {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList) as typeof window.matchMedia
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const match = MATCHES['r16-1'] as PlayedMatch

/** A 90-minute sim (no extra time, no shootout) that contains at least one goal. */
function simWithGoal(): { firstHalf: HalftimeState; sim: SimResult } {
  for (let seed = 1; seed < 200; seed++) {
    const firstHalf = playFirstHalf(
      buildRealSheet(match.home),
      buildRealSheet(match.away),
      seed,
      matchSimOptions(match),
    )
    const sim = resumeMatch(firstHalf, firstHalf.home.sheet, firstHalf.away.sheet)
    if (!sim.wentToExtraTime && !sim.shootout && sim.events.some((e) => e.type === 'goal')) {
      return { firstHalf, sim }
    }
  }
  throw new Error('no seed produced a 90-minute match with a goal')
}

describe('MatchSim goal celebration (regression: overlay never dismissed)', () => {
  it('shows the celebration during playback and dismisses it after the linger', () => {
    // Fake timers drive both the rAF playhead loop and the dismissal timeout,
    // reproducing the real playback conditions where visibleGoals gets a new
    // identity every frame. performance must be faked alongside rAF or the
    // playhead (and framer-motion's exit) would measure real elapsed time.
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    })
    const { firstHalf, sim } = simWithGoal()
    const lineups = initialMatchState(match).lineups

    render(
      <MatchSim
        match={match}
        firstHalf={firstHalf}
        sim={sim}
        lineups={lineups}
        home={TEAMS[match.home.teamId]}
        away={TEAMS[match.away.teamId]}
        resuming={false}
        onResume={() => {}}
        onDone={() => {}}
      />,
    )

    // Play until the LAST goal crosses the playhead, advancing one 16ms frame
    // per act so every frame's render and effects flush before the next — the
    // cadence a real browser has, and the one the original bug depended on
    // (the dismissal timer was cleared by every frame's effect cleanup).
    const goalMinutes = sim.events.filter((e) => e.type === 'goal').map((e) => e.minute)
    const lastGoalMinute = Math.max(...goalMinutes)
    let appeared = false
    // 90 match-min at 5 min/s is 18s ≈ 1125 frames; cap generously.
    for (let i = 0; i < 1400; i++) {
      act(() => vi.advanceTimersByTime(16))
      if (screen.queryByText('Goal!')) appeared = true
      if (appeared && screen.getByLabelText<HTMLInputElement>('Match minute').valueAsNumber >= lastGoalMinute) break
    }
    expect(appeared).toBe(true)

    // Keep playing frame by frame past the 2.1s linger: the overlay must
    // dismiss itself even though frames keep re-running the goal effect.
    for (let i = 0; i < 170; i++) {
      act(() => vi.advanceTimersByTime(16))
    }
    expect(screen.queryByText('Goal!')).toBeNull()
  })
})
