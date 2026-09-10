/**
 * Shared UI tokens. Colours are semantic CSS variables defined in index.css
 * for both themes; per-team identity colours live in data/teams.ts. Recipes
 * below are Tailwind class strings so every screen composes the same system.
 */

/** Neutral mark for non-identity bars (draw probability, scoreline counts). */
export const NEUTRAL_MARK = 'var(--color-muted)'

export const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const

/** Standard content card: raised surface, hairline, soft shadow. */
export const CARD = 'rounded-2xl border border-ink/10 bg-night-2/80 shadow-lg shadow-shade/20 backdrop-blur-sm'
/** Nested panel inside a card (bench, notes, code blocks). */
export const PANEL = 'rounded-xl border border-ink/10 bg-night/40'
/** Small utility label above a block. */
export const LABEL = 'text-[11px] font-bold uppercase tracking-widest text-muted'
/** Section heading inside a card. */
export const HEADING = 'font-display text-lg font-black uppercase tracking-widest text-floodlight'
/** Keyboard focus treatment for anything clickable. */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/70'
/** Secondary (bordered) button/link. */
export const BTN_SECONDARY = `rounded-lg border border-ink/15 bg-night-2/40 text-sm font-semibold text-muted transition-colors hover:border-ink/40 hover:text-floodlight ${FOCUS_RING}`
/** Primary call to action: the brand gradient with theme-inverted text. */
export const BTN_PRIMARY = `rounded-lg bg-gradient-to-r from-brand-a to-brand-b font-display font-black uppercase tracking-widest text-night shadow-lg shadow-shade/30 transition-transform hover:scale-[1.02] active:scale-[0.98] ${FOCUS_RING}`
/** Pill chip for small status badges. */
export const CHIP = 'rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest'
