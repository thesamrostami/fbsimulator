// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

describe('LineupEditor instructions', () => {
  it('offers the three dials, starts neutral, and applies a change to the selected side only', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const panel = within(screen.getByTestId('tactics'))
    for (const dial of ['Mentality', 'Pressing', 'Width']) {
      expect(panel.getByRole('radiogroup', { name: dial })).toBeDefined()
    }
    expect(panel.getByRole('radio', { name: 'Balanced' }).getAttribute('aria-checked')).toBe('true')
    expect(panel.getByText(/as the real match was played/i)).toBeDefined()

    await user.click(panel.getByRole('radio', { name: 'High press' }))
    expect(panel.getByRole('radio', { name: 'High press' }).getAttribute('aria-checked')).toBe('true')
    expect(panel.getByText(/effects? in play/i)).toBeDefined()
    expect(panel.getByText(/press turnovers/)).toBeDefined()

    // The other side keeps its own, still-neutral instructions.
    await user.click(screen.getByRole('tab', { name: /England/i }))
    expect(within(screen.getByTestId('tactics')).getByRole('radio', { name: 'Mid' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('LineupEditor drag-and-drop', () => {
  it('swaps a bench player onto a starter by dragging with a mouse', () => {
    render(<Harness />)
    const pitch = () => within(screen.getByTestId('pitch'))
    const bench = () => within(screen.getByTestId('bench'))
    const from = bench().getByText('Vargas').closest('button')!
    const to = pitch().getByText('Jimenez').closest('button')!

    // jsdom has no layout: point the hit test at the drop target ourselves.
    const original = document.elementFromPoint
    document.elementFromPoint = () => to
    try {
      fireEvent.pointerDown(from, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10 })
      fireEvent.pointerMove(from, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 40 })
      // The ghost follows the pointer; the target is highlighted.
      expect(to.className).toMatch(/border-floodlight/)
      fireEvent.pointerUp(from, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 40 })
    } finally {
      document.elementFromPoint = original
    }

    expect(pitch().getByText('Vargas')).toBeDefined()
    expect(bench().getByText('Jimenez')).toBeDefined()
    // The click the browser fires after a drag must not start a tap-to-swap.
    fireEvent.click(pitch().getByText('Vargas').closest('button')!)
    expect(pitch().getByText('Vargas').closest('button')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('leaves a short press alone: below the threshold it is a tap', () => {
    render(<Harness />)
    const pitch = within(screen.getByTestId('pitch'))
    const chip = pitch.getByText('Jimenez').closest('button')!
    fireEvent.pointerDown(chip, { button: 0, pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(chip, { pointerId: 2, pointerType: 'mouse', clientX: 12, clientY: 11 })
    fireEvent.pointerUp(chip, { pointerId: 2, pointerType: 'mouse', clientX: 12, clientY: 11 })
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })
})
