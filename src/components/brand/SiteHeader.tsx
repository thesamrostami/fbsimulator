import { Link, NavLink } from 'react-router-dom'
import { FOCUS_RING } from '../../ui/theme'
import { ThemeToggle } from '../../ui/themeMode'
import { Wordmark } from './Wordmark'

const NAV: { to: string; label: string }[] = [
  { to: '/bracket', label: 'Bracket' },
  { to: '/how-it-works', label: 'How it works' },
]

/**
 * Sticky site chrome for every page but the intro: wordmark home link, the
 * two destinations, and the theme switch. Translucent so the page's glows
 * read through it.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-night/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-6 sm:px-4 sm:py-2.5">
        <Link to="/" className={`shrink-0 rounded ${FOCUS_RING}`} aria-label="The Replay Cup — home">
          <Wordmark compact small />
        </Link>
        <nav aria-label="Site" className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors sm:px-3 sm:text-xs sm:tracking-widest ${FOCUS_RING} ${
                  isActive ? 'bg-ink/8 text-floodlight' : 'text-muted hover:text-floodlight'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <ThemeToggle className="ml-1 sm:ml-2" compact />
        </nav>
      </div>
    </header>
  )
}
