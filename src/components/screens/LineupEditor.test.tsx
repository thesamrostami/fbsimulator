// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MATCHES, type PlayedMatch } from '../../data/matches'
import { initialMatchState, matchAppReducer } from '../../state/appState'
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
    <LineupEditor match={match} state={state} dispatch={dispatch} onKickOff={() => {}} simulating={false} />
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
})
