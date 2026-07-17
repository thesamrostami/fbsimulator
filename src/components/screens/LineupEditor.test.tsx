// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useReducer } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MATCHES, type PlayedMatch } from '../../data/matches'
import { initialMatchState, makeHalftimeReducer, matchAppReducer } from '../../state/appState'
import { LineupEditor } from './LineupEditor'

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

afterEach(cleanup)

const match = MATCHES['r16-4'] as PlayedMatch

function Harness() {
  const [state, dispatch] = useReducer(matchAppReducer, match, initialMatchState)
  return (
    <LineupEditor match={match} lineups={state.lineups} dispatch={dispatch} onKickOff={() => {}} simulating={false} />
  )
}

const firstHalfLineups = initialMatchState(match).lineups

function HalftimeHarness({ dismissed = [] }: { dismissed?: string[] }) {
  const reducer = useMemo(() => makeHalftimeReducer(firstHalfLineups), [])
  const [lineups, dispatch] = useReducer(reducer, firstHalfLineups)
  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed])
  return (
    <LineupEditor
      match={match}
      lineups={lineups}
      dispatch={dispatch}
      onKickOff={() => {}}
      simulating={false}
      mode="halftime"
      firstHalfStarters={{
        home: firstHalfLineups.home.startersBySlot,
        away: firstHalfLineups.away.startersBySlot,
      }}
      dismissed={dismissedSet}
    />
  )
}

describe('LineupEditor bench swaps (regression: stale pitch render)', () => {
  it('renders a bench-for-starter swap on the pitch immediately, with no other interaction', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const pitch = () => within(screen.getByTestId('pitch'))
    const bench = () => within(screen.getByTestId('bench'))

    // Before: Jimenez starts at ST, Vargas sits on the bench.
    expect(pitch().getByText('Jimenez')).toBeDefined()
    expect(bench().getByText('Vargas')).toBeDefined()
    expect(pitch().queryByText('Vargas')).toBeNull()

    // Swap: tap the bench player, then the starter. Nothing else.
    await user.click(bench().getByText('Vargas'))
    await user.click(pitch().getByText('Jimenez'))

    // Immediately after the swap event: Vargas on the pitch, Jimenez on the bench.
    expect(pitch().getByText('Vargas')).toBeDefined()
    expect(bench().getByText('Jimenez')).toBeDefined()
    expect(pitch().queryByText('Jimenez')).toBeNull()
    expect(bench().queryByText('Vargas')).toBeNull()

    // Exactly one chip per player anywhere — no stale duplicates left behind.
    expect(screen.getAllByText('Vargas')).toHaveLength(1)
    expect(screen.getAllByText('Jimenez')).toHaveLength(1)
  })

  it('renders pitch-to-pitch swaps immediately too', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const pitch = within(screen.getByTestId('pitch'))

    // Swap the ST (Jimenez) with the LW (Quinones): both stay on the pitch,
    // roles trade places — the role label under each name must update at once.
    await user.click(pitch.getByText('Jimenez'))
    await user.click(pitch.getByText('Quinones'))

    const chipRole = (name: string) =>
      within(pitch.getByText(name).closest('button')!).getByText(/^(ST|LW|RW|CM|RB|LB|CB|GK)$/).textContent
    expect(chipRole('Jimenez')).toBe('LW')
    expect(chipRole('Quinones')).toBe('ST')
  })

  it('shows no substitution counter in pre-match mode', () => {
    render(<Harness />)
    expect(screen.queryByTestId('subs-counter')).toBeNull()
  })
})

describe('LineupEditor half-time mode', () => {
  it('never renders a sent-off player as selectable — not on the pitch, not on the bench', () => {
    render(<HalftimeHarness dismissed={['mex-jimenez']} />)

    // The slot shows a non-interactive "sent off" hole, never a tappable chip.
    for (const el of screen.getAllByText('Jimenez')) {
      expect(el.closest('button')).toBeNull()
    }
    expect(screen.getByText('Sent off')).toBeDefined()
    expect(within(screen.getByTestId('bench')).queryByText('Jimenez')).toBeNull()

    // Everyone else is still a normal chip.
    expect(within(screen.getByTestId('pitch')).getByText('Quinones').closest('button')).not.toBeNull()
  })

  it('counts personnel changes live in the subs counter', async () => {
    const user = userEvent.setup()
    render(<HalftimeHarness />)

    expect(screen.getByTestId('subs-counter').textContent).toBe('0 / 5')

    const bench = within(screen.getByTestId('bench'))
    const pitch = within(screen.getByTestId('pitch'))
    await user.click(bench.getByText('Vargas'))
    await user.click(pitch.getByText('Jimenez'))

    expect(screen.getByTestId('subs-counter').textContent).toBe('1 / 5')

    // Formation-only change: still one personnel change.
    await user.click(screen.getByRole('radio', { name: /4-4-2/ }))
    expect(screen.getByTestId('subs-counter').textContent).toBe('1 / 5')
  })
})
