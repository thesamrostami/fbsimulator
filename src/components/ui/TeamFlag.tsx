import {
  AR,
  BE,
  BR,
  CA,
  CH,
  CO,
  EG,
  ES,
  FR,
  MA,
  MX,
  NO,
  PT,
  PY,
  US,
} from 'country-flag-icons/react/3x2'
import type { ComponentType } from 'react'
import type { TeamId } from '../../data/teams'

/** The only prop we ever pass a flag SVG; keeps the package's own prop type out of our surface. */
type FlagSvg = ComponentType<{ className?: string }>

/**
 * England is a home nation, not an ISO country — the icon package only ships
 * GB, so we draw the St George's Cross ourselves (3:2, cross ~1/5 of height).
 */
function StGeorgesCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect x="13" width="4" height="20" fill="#ce1124" />
      <rect y="8" width="30" height="4" fill="#ce1124" />
    </svg>
  )
}

const FLAGS: Record<TeamId, FlagSvg> = {
  PAR: PY,
  FRA: FR,
  CAN: CA,
  MAR: MA,
  BRA: BR,
  NOR: NO,
  MEX: MX,
  ENG: StGeorgesCross,
  POR: PT,
  ESP: ES,
  USA: US,
  BEL: BE,
  ARG: AR,
  EGY: EG,
  SUI: CH,
  COL: CO,
}

interface TeamFlagProps {
  /** null renders the "to be decided" placeholder. */
  teamId: TeamId | null
  /** Tailwind height class; width follows the 3:2 ratio. Default h-4. */
  className?: string
  /** Accessible name; defaults to the team id. Pass '' for decorative use next to the team name. */
  title?: string
}

/**
 * SVG team flag with the app's standard treatment: 3:2 ratio, subtle rounding,
 * and a thin ring so white flag areas don't bleed into the dark surfaces.
 */
export function TeamFlag({ teamId, className = 'h-4', title }: TeamFlagProps) {
  const label = title ?? teamId ?? 'To be decided'
  if (!teamId) {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-flex aspect-[3/2] items-center justify-center rounded-[3px] bg-white/5 align-[-0.15em] text-[0.6em] font-bold text-muted ring-1 ring-inset ring-white/15 ${className}`}
      >
        ?
      </span>
    )
  }
  const Flag = FLAGS[teamId]
  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-block overflow-hidden rounded-[3px] align-[-0.15em] ${className}`}
    >
      <Flag className="block h-full w-auto" />
      {/* Ring painted above the flag so white fields don't bleed into dark surfaces. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-white/25" />
    </span>
  )
}
