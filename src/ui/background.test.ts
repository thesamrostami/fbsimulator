import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read the stylesheet as text (the Tailwind plugin intercepts `?raw` imports).
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

/**
 * Regression: the floodlight gradient must live on a single fixed
 * full-viewport layer. When it sat on `body` (whose height is capped at 100%
 * of the viewport), the glows ended partway down tall pages as a visible seam.
 */
describe('background gradient strategy', () => {
  const bodyBefore = css.match(/body::before\s*\{[^}]*\}/)?.[0]

  it('paints the gradient on a fixed body::before layer', () => {
    expect(bodyBefore).toBeDefined()
    expect(bodyBefore).toMatch(/position:\s*fixed/)
    expect(bodyBefore).toMatch(/inset:\s*0/)
    expect((bodyBefore!.match(/radial-gradient/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps body itself gradient-free (flat color only)', () => {
    const bodyRule = css.match(/(^|\n)body\s*\{[^}]*\}/)?.[0]
    expect(bodyRule).toBeDefined()
    expect(bodyRule).not.toMatch(/gradient/)
  })

  it('ships the themed scrollbars for both engines', () => {
    expect(css).toMatch(/scrollbar-width:\s*thin/)
    expect(css).toMatch(/::-webkit-scrollbar-thumb/)
    expect(css).toMatch(/scrollbar-gutter:\s*stable/)
  })
})
