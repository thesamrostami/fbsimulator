import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TEAM_PALETTE_CSS, type ThemeName } from '../data/teams'
import { FOCUS_RING } from './theme'
import { applyTheme, readStoredMode, resolveTheme, THEME_STORAGE_KEY, ThemeContext, useTheme, type ThemeMode } from './themeState'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (typeof window === 'undefined' ? 'system' : readStoredMode()))
  const [theme, setTheme] = useState<ThemeName>(() => (typeof window === 'undefined' ? 'dark' : resolveTheme(mode)))

  useEffect(() => {
    setTheme(resolveTheme(mode))
    if (mode !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!mq) return
    const onChange = () => setTheme(resolveTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Best effort: the choice just won't persist.
    }
  }, [])

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode])
  return (
    <ThemeContext.Provider value={value}>
      {/* Team identity colours for both themes, defined once. */}
      <style>{TEAM_PALETTE_CSS}</style>
      {children}
    </ThemeContext.Provider>
  )
}

const OPTIONS: { mode: ThemeMode; label: string; glyph: string }[] = [
  { mode: 'light', label: 'Light theme', glyph: '☀' },
  { mode: 'system', label: 'Follow the system theme', glyph: '◐' },
  { mode: 'dark', label: 'Dark theme', glyph: '☾' },
]

/**
 * Three-way segmented switch: light · system · dark. With `compact`, phones
 * get a single button that cycles through the three instead.
 */
export function ThemeToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { mode, setMode } = useTheme()
  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[1]
  const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length]
  return (
    <>
      {compact && (
        <button
          type="button"
          aria-label={`Colour theme: ${current.label}. Switch to ${next.label.toLowerCase()}`}
          title={current.label}
          onClick={() => setMode(next.mode)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/12 bg-night-2/70 text-[14px] leading-none text-floodlight backdrop-blur-sm sm:hidden ${FOCUS_RING} ${className}`}
        >
          <span aria-hidden="true">{current.glyph}</span>
        </button>
      )}
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`${compact ? 'hidden sm:inline-flex' : 'inline-flex'} rounded-full border border-ink/12 bg-night-2/70 p-0.5 backdrop-blur-sm ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = option.mode === mode
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setMode(option.mode)}
            className={`h-7 w-7 rounded-full text-[13px] leading-none transition-colors ${FOCUS_RING} ${
              active ? 'bg-ink/12 text-floodlight' : 'text-muted hover:text-floodlight'
            }`}
          >
            <span aria-hidden="true">{option.glyph}</span>
          </button>
        )
      })}
    </div>
    </>
  )
}
