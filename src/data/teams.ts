/**
 * The 16 knockout-stage teams. Each team has two identity colours per theme:
 * `accent` is the bright colour for text, glows and borders; `chart` the
 * mark colour for charts. The DARK set is hand-picked and was validated with
 * the dataviz palette checker against the dark surface (#081a10) for every
 * pairing that shares a chart. The LIGHT set is derived from it: each colour
 * is pulled toward the ink until it clears a 4.5:1 contrast on white (text)
 * or 3:1 (chart marks), so the same identity reads on a daylight page.
 *
 * Components never see hex: `color` and `chartColor` are CSS custom properties
 * that follow the active theme (see TEAM_PALETTE_CSS, injected once by
 * ThemeProvider). JavaScript consumers that need a real colour value — the
 * three.js scene, canvas textures — resolve one with `teamHex(id, theme)`.
 */

export type TeamId =
  | 'PAR'
  | 'FRA'
  | 'CAN'
  | 'MAR'
  | 'BRA'
  | 'NOR'
  | 'MEX'
  | 'ENG'
  | 'POR'
  | 'ESP'
  | 'USA'
  | 'BEL'
  | 'ARG'
  | 'EGY'
  | 'SUI'
  | 'COL'

export type ThemeName = 'dark' | 'light'

export interface TeamPalette {
  accent: string
  chart: string
}

export interface TeamInfo {
  id: TeamId
  name: string
  shortName: string
  /** Theme-aware accent: a CSS custom property, usable anywhere CSS colours are. */
  color: string
  /** Theme-aware chart mark colour: a CSS custom property. */
  chartColor: string
}

const DARK: Record<TeamId, TeamPalette> = {
  PAR: { accent: '#f0707a', chart: '#e05c66' },
  FRA: { accent: '#6b8ffc', chart: '#4a72e8' },
  CAN: { accent: '#e05555', chart: '#b83d3d' },
  MAR: { accent: '#4cc973', chart: '#3fae5c' },
  BRA: { accent: '#e6c235', chart: '#ac8b16' },
  NOR: { accent: '#ef5f70', chart: '#c94856' },
  MEX: { accent: '#2fbf71', chart: '#1fa860' },
  ENG: { accent: '#5aa9ff', chart: '#4a8fe0' },
  POR: { accent: '#ea5f5f', chart: '#cc4444' },
  ESP: { accent: '#f2c531', chart: '#b98c12' },
  USA: { accent: '#7b9ff2', chart: '#5a7fd6' },
  BEL: { accent: '#e65555', chart: '#c73a3a' },
  ARG: { accent: '#58bef7', chart: '#3f9fd6' },
  EGY: { accent: '#f26666', chart: '#d94848' },
  SUI: { accent: '#e55151', chart: '#c13a3a' },
  COL: { accent: '#e8bc3d', chart: '#b58f1f' },
}

const NAMES: Record<TeamId, { name: string; shortName: string }> = {
  PAR: { name: 'Paraguay', shortName: 'PAR' },
  FRA: { name: 'France', shortName: 'FRA' },
  CAN: { name: 'Canada', shortName: 'CAN' },
  MAR: { name: 'Morocco', shortName: 'MAR' },
  BRA: { name: 'Brazil', shortName: 'BRA' },
  NOR: { name: 'Norway', shortName: 'NOR' },
  MEX: { name: 'Mexico', shortName: 'MEX' },
  ENG: { name: 'England', shortName: 'ENG' },
  POR: { name: 'Portugal', shortName: 'POR' },
  ESP: { name: 'Spain', shortName: 'ESP' },
  USA: { name: 'United States', shortName: 'USA' },
  BEL: { name: 'Belgium', shortName: 'BEL' },
  ARG: { name: 'Argentina', shortName: 'ARG' },
  EGY: { name: 'Egypt', shortName: 'EGY' },
  SUI: { name: 'Switzerland', shortName: 'SUI' },
  COL: { name: 'Colombia', shortName: 'COL' },
}

// ── Colour maths (sRGB, WCAG relative luminance) ────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a))
  const lb = luminance(hexToRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const LIGHT_SURFACE = '#ffffff'
const LIGHT_INK = '#0b1a12'

/** Pull a colour toward the light theme's ink until it clears the contrast bar on white. */
function darkenForLight(hex: string, minContrast: number): string {
  const target = hexToRgb(LIGHT_INK)
  const base = hexToRgb(hex)
  for (let t = 0; t <= 1; t += 0.02) {
    const mixed: [number, number, number] = [
      base[0] + (target[0] - base[0]) * t,
      base[1] + (target[1] - base[1]) * t,
      base[2] + (target[2] - base[2]) * t,
    ]
    const candidate = rgbToHex(mixed)
    if (contrastRatio(candidate, LIGHT_SURFACE) >= minContrast) return candidate
  }
  return LIGHT_INK
}

const LIGHT: Record<TeamId, TeamPalette> = Object.fromEntries(
  (Object.keys(DARK) as TeamId[]).map((id) => [
    id,
    { accent: darkenForLight(DARK[id].accent, 4.5), chart: darkenForLight(DARK[id].chart, 3.2) },
  ]),
) as Record<TeamId, TeamPalette>

export const TEAM_HEX: Record<ThemeName, Record<TeamId, TeamPalette>> = { dark: DARK, light: LIGHT }

/** The real colour values behind a team's CSS variables for one theme. */
export function teamHex(id: TeamId, theme: ThemeName): TeamPalette {
  return TEAM_HEX[theme][id]
}

const varName = (id: TeamId, kind: 'accent' | 'chart') => `--team-${id}${kind === 'chart' ? '-chart' : ''}`

/** CSS that defines every team variable for both themes; ThemeProvider injects it once. */
export const TEAM_PALETTE_CSS: string = (() => {
  const block = (theme: ThemeName) =>
    (Object.keys(DARK) as TeamId[])
      .map((id) => `${varName(id, 'accent')}:${TEAM_HEX[theme][id].accent};${varName(id, 'chart')}:${TEAM_HEX[theme][id].chart};`)
      .join('')
  return `:root{${block('dark')}}:root[data-theme="light"]{${block('light')}}`
})()

export const TEAMS: Record<TeamId, TeamInfo> = Object.fromEntries(
  (Object.keys(DARK) as TeamId[]).map((id) => [
    id,
    {
      id,
      ...NAMES[id],
      color: `var(${varName(id, 'accent')})`,
      chartColor: `var(${varName(id, 'chart')})`,
    },
  ]),
) as Record<TeamId, TeamInfo>

export function isTeamId(id: string | undefined): id is TeamId {
  return id !== undefined && id in TEAMS
}

/**
 * A translucent version of any CSS colour (including the team variables),
 * for glows, tints and halos: the theme-safe replacement for `#rrggbbaa`.
 */
export function tint(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}
