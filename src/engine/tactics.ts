import type { Tactics, TeamSheet } from './types'

/**
 * Team instructions and what they do inside the possession engine. Every
 * multiplier is 1 at the neutral setting, so a sheet without tactics plays
 * exactly like balanced / mid / normal. The effects are deliberately modest
 * (a few percent each) and always a trade-off: attacking creates more but
 * concedes more counters; a high press wins the ball high but fouls more and
 * is exposed once beaten; width trades cross volume for chance quality.
 */

export const DEFAULT_TACTICS: Tactics = { mentality: 'balanced', pressing: 'mid', width: 'normal' }

export interface TacticalProfile {
  /** Per-minute chance that this side's possession is a real attack, not sterile circulation. */
  attackRate: number
  /** Progression step success in the middle and final thirds. */
  progression: number
  /** Resistance to the opponent's progression and final-third entries (divides their step success). */
  defence: number
  /** Chance a turnover we force becomes a fast break. */
  counterFor: number
  /** Chance a turnover we suffer becomes a fast break against us. */
  counterAgainst: number
  /** Chance the opponent's own-third build-up is dispossessed by the press. */
  pressRegain: number
  /** Foul rate when defending. */
  fouls: number
  /** Share of final-third entries that are crosses (vs central play). */
  crossShare: number
  /** Chance quality against us from central positions (compactness). */
  centralConceded: number
  /** Chance quality against us from crosses. */
  crossConceded: number
  /** Where the block sits: shifts the starting point of possessions (attacking-frame x). */
  lineShift: number
}

const NEUTRAL: TacticalProfile = {
  attackRate: 1,
  progression: 1,
  defence: 1,
  counterFor: 1,
  counterAgainst: 1,
  pressRegain: 1,
  fouls: 1,
  crossShare: 0.32,
  centralConceded: 1,
  crossConceded: 1,
  lineShift: 0,
}

const MENTALITY: Record<Tactics['mentality'], Partial<TacticalProfile>> = {
  defensive: { attackRate: 0.84, progression: 0.95, defence: 1.06, counterFor: 1.2, counterAgainst: 0.7, lineShift: -0.05 },
  balanced: {},
  attacking: { attackRate: 1.15, progression: 1.05, defence: 0.93, counterFor: 0.85, counterAgainst: 1.35, lineShift: 0.05 },
}

const PRESSING: Record<Tactics['pressing'], Partial<TacticalProfile>> = {
  low: { pressRegain: 0.7, fouls: 0.9, defence: 1.04, counterAgainst: 0.9 },
  mid: {},
  high: { pressRegain: 1.45, fouls: 1.2, defence: 0.97, counterAgainst: 1.15 },
}

const WIDTH: Record<Tactics['width'], Partial<TacticalProfile>> = {
  narrow: { crossShare: 0.18, centralConceded: 0.95, crossConceded: 1.08 },
  normal: {},
  wide: { crossShare: 0.46, centralConceded: 1.05, crossConceded: 0.94 },
}

const MULTIPLICATIVE: (keyof TacticalProfile)[] = [
  'attackRate',
  'progression',
  'defence',
  'counterFor',
  'counterAgainst',
  'pressRegain',
  'fouls',
  'centralConceded',
  'crossConceded',
]

/** Combine the three instructions into one profile. */
export function tacticalProfile(tactics: Tactics = DEFAULT_TACTICS): TacticalProfile {
  const profile: TacticalProfile = { ...NEUTRAL }
  for (const part of [MENTALITY[tactics.mentality], PRESSING[tactics.pressing], WIDTH[tactics.width]]) {
    for (const key of MULTIPLICATIVE) if (part[key] !== undefined) profile[key] *= part[key]!
    if (part.crossShare !== undefined) profile.crossShare = part.crossShare
    if (part.lineShift !== undefined) profile.lineShift += part.lineShift
  }
  return profile
}

export function sheetTactics(sheet: TeamSheet): Tactics {
  return sheet.tactics ?? DEFAULT_TACTICS
}

/** Human summary of the non-neutral instructions, for reasoning text and the UI. */
export function describeTactics(tactics: Tactics): string {
  const parts: string[] = []
  if (tactics.mentality !== 'balanced') parts.push(`${tactics.mentality} mentality`)
  if (tactics.pressing !== 'mid') parts.push(`${tactics.pressing} press`)
  if (tactics.width !== 'normal') parts.push(`${tactics.width} width`)
  return parts.join(', ')
}

export interface TacticOption<K extends keyof Tactics> {
  value: Tactics[K]
  label: string
  /** What it does inside the engine, in one line. */
  blurb: string
}

/** The three instruction dials, in display order, with their choices. */
export const TACTIC_DIALS: {
  key: keyof Tactics
  label: string
  options: TacticOption<keyof Tactics>[]
}[] = [
  {
    key: 'mentality',
    label: 'Mentality',
    options: [
      { value: 'defensive', label: 'Defensive', blurb: 'Sit deeper and create less, concede far fewer fast breaks — and hit more of your own.' },
      { value: 'balanced', label: 'Balanced', blurb: 'The shape as it was played — no modifier in any phase.' },
      { value: 'attacking', label: 'Attacking', blurb: 'Commit bodies forward: more final-third entries, but the middle opens up and breaks come back at you.' },
    ],
  },
  {
    key: 'pressing',
    label: 'Pressing',
    options: [
      { value: 'low', label: 'Low block', blurb: 'Let them have the ball in their own third; fewer fouls, harder to play through.' },
      { value: 'mid', label: 'Mid', blurb: 'Standard engagement — no modifier.' },
      { value: 'high', label: 'High press', blurb: 'Hunt the ball in their half: more turnovers to break from, more fouls, exposed once it is beaten.' },
    ],
  },
  {
    key: 'width',
    label: 'Width',
    options: [
      { value: 'narrow', label: 'Narrow', blurb: 'Central combinations and through-balls; compact against crosses in, but wide crosses hurt more.' },
      { value: 'normal', label: 'Normal', blurb: 'The shape as played — no modifier.' },
      { value: 'wide', label: 'Wide', blurb: 'More crosses and headed chances of lower quality; the centre is a little more open.' },
    ],
  },
]

/** The non-neutral multipliers of a profile, as short chips for the editor ("creates ×1.15"). */
export function describeProfile(tactics: Tactics): string[] {
  const p = tacticalProfile(tactics)
  const chips: string[] = []
  const fmt = (label: string, value: number) => `${label} ×${value.toFixed(2)}`
  if (p.attackRate !== 1) chips.push(fmt('chance creation', p.attackRate))
  if (p.progression !== 1) chips.push(fmt('progression', p.progression))
  if (p.defence !== 1) chips.push(fmt('resistance', p.defence))
  if (p.pressRegain !== 1) chips.push(fmt('press turnovers', p.pressRegain))
  if (p.counterFor !== 1) chips.push(fmt('own breaks', p.counterFor))
  if (p.counterAgainst !== 1) chips.push(fmt('breaks conceded', p.counterAgainst))
  if (p.fouls !== 1) chips.push(fmt('fouls', p.fouls))
  if (p.crossShare !== 0.32) chips.push(`crosses ${Math.round(p.crossShare * 100)}% of entries`)
  if (p.centralConceded !== 1) chips.push(fmt('central chances conceded', p.centralConceded))
  if (p.crossConceded !== 1) chips.push(fmt('crosses conceded', p.crossConceded))
  return chips
}
