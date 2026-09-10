import { createContext, useContext } from 'react'
import type { ThemeName } from '../data/teams'

/**
 * Light / dark theming state. The user's choice ('light' | 'dark') or
 * 'system' is kept in localStorage; the resolved theme is stamped on
 * <html data-theme> where the stylesheet's tokens (and the team colour
 * variables) switch. public/theme-init.js applies the same rule before first
 * paint so a light-mode reader never sees a dark flash. Components live in
 * themeMode.tsx.
 */

export type ThemeMode = ThemeName | 'system'

export const THEME_STORAGE_KEY = 'replay-cup-theme'

/** Page chrome colour per theme, mirrored into <meta name="theme-color">. */
const THEME_COLOR: Record<ThemeName, string> = { dark: '#050d09', light: '#f3f6f1' }

function systemTheme(): ThemeName {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage can be unavailable (private mode, blocked); fall through.
  }
  return 'system'
}

export function resolveTheme(mode: ThemeMode): ThemeName {
  return mode === 'system' ? systemTheme() : mode
}

/** Stamp the resolved theme on the document. Exported for the pre-paint script parity test. */
export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement
  const changed = root.dataset.theme !== undefined && root.dataset.theme !== theme
  root.dataset.theme = theme
  root.style.colorScheme = theme
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLOR[theme]
  if (changed) {
    root.classList.add('theme-switching')
    window.setTimeout(() => root.classList.remove('theme-switching'), 260)
  }
}

export interface ThemeContextValue {
  mode: ThemeMode
  theme: ThemeName
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue>({ mode: 'system', theme: 'dark', setMode: () => {} })


export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
