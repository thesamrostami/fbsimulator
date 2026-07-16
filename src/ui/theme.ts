/**
 * Shared UI tokens. Per-team accent and chart colors live in data/teams.ts,
 * where every real match pairing is validated with the dataviz palette
 * checker against the dark surface (#081a10).
 */

/** Neutral mark for non-identity bars (draw probability, scoreline counts). */
export const NEUTRAL_MARK = '#66786d'

export const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const

/* Shared surface + control recipes so every screen composes the same system. */

/** Standard content card. */
export const CARD = 'rounded-2xl border border-white/10 bg-night-2/70'
/** Nested panel inside a card (bench, notes, code blocks). */
export const PANEL = 'rounded-xl border border-white/10 bg-night-2/60'
/** Small utility label above a block. */
export const LABEL = 'text-[11px] font-bold uppercase tracking-widest text-muted'
/** Keyboard focus treatment for anything clickable. */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-yellow/70'
/** Secondary (bordered) button/link. */
export const BTN_SECONDARY = `rounded-lg border border-white/15 text-sm font-semibold text-muted transition-colors hover:border-white/40 hover:text-floodlight ${FOCUS_RING}`
