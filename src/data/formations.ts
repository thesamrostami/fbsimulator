import type { FormationSlot, Line } from '../engine/types'

/**
 * Formation catalog: pitch layout (as horizontal bands) plus the engine
 * modifiers each shape applies to a team's phase ratings. The eight
 * PICKER_FORMATIONS are always selectable; 4-5-1 and 5-1-4 exist because real
 * 2026 lineups used them, and a team's real formation is always available.
 *
 * Modifiers multiply the aggregated phase ratings (documented on
 * /how-it-works and cited in event reasoning): midfield also drives the
 * possession tug-of-war, so a midfield penalty is a possession penalty;
 * chanceQuality scales the xG roll of every chance the team creates.
 */

export type FormationName =
  | '4-3-3'
  | '4-4-2'
  | '4-2-3-1'
  | '3-5-2'
  | '5-3-2'
  | '5-4-1'
  | '4-2-4'
  | '3-4-3'
  | '4-5-1'
  | '5-1-4'

export interface FormationModifiers {
  attack: number
  midfield: number
  defence: number
  chanceQuality: number
}

interface FormationBand {
  line: Line
  count: number
  /** Band centre, y from own goal (0) to opponent goal (100). */
  y: number
  /** Explicit labels for this band; defaults derived from line + count. */
  labels?: string[]
}

export interface FormationDef {
  name: FormationName
  bands: FormationBand[]
  modifiers: FormationModifiers
  blurb: string
}

const even = { attack: 1, midfield: 1, defence: 1, chanceQuality: 1 }

export const FORMATIONS: Record<FormationName, FormationDef> = {
  '4-3-3': {
    name: '4-3-3',
    bands: [
      { line: 'DEF', count: 4, y: 24 },
      { line: 'MID', count: 3, y: 48 },
      { line: 'FWD', count: 3, y: 78 },
    ],
    modifiers: { ...even },
    blurb: 'The balanced baseline — no modifier in any phase.',
  },
  '4-4-2': {
    name: '4-4-2',
    bands: [
      { line: 'DEF', count: 4, y: 24 },
      { line: 'MID', count: 4, y: 48 },
      { line: 'FWD', count: 2, y: 80 },
    ],
    modifiers: { attack: 0.98, midfield: 1.03, defence: 1.02, chanceQuality: 0.98 },
    blurb: 'Two compact banks of four: solid and hard to play through, slightly less incisive.',
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    bands: [
      { line: 'DEF', count: 4, y: 24 },
      { line: 'MID', count: 2, y: 40, labels: ['DM', 'DM'] },
      { line: 'MID', count: 3, y: 60, labels: ['AM', 'AM', 'AM'] },
      { line: 'FWD', count: 1, y: 82 },
    ],
    modifiers: { attack: 1, midfield: 1.02, defence: 1, chanceQuality: 1.06 },
    blurb: 'A double pivot frees the three behind the striker — chance quality rises.',
  },
  '3-5-2': {
    name: '3-5-2',
    bands: [
      { line: 'DEF', count: 3, y: 22 },
      { line: 'MID', count: 5, y: 48 },
      { line: 'FWD', count: 2, y: 80 },
    ],
    modifiers: { attack: 1, midfield: 1.05, defence: 0.96, chanceQuality: 1 },
    blurb: 'Midfield overload wins possession, but the back three can be exposed wide.',
  },
  '5-3-2': {
    name: '5-3-2',
    bands: [
      { line: 'DEF', count: 5, y: 24 },
      { line: 'MID', count: 3, y: 48 },
      { line: 'FWD', count: 2, y: 80 },
    ],
    modifiers: { attack: 0.93, midfield: 0.98, defence: 1.08, chanceQuality: 1 },
    blurb: 'Five at the back: defence up, attacking presence down.',
  },
  '5-4-1': {
    name: '5-4-1',
    bands: [
      { line: 'DEF', count: 5, y: 24 },
      { line: 'MID', count: 4, y: 48 },
      { line: 'FWD', count: 1, y: 82 },
    ],
    modifiers: { attack: 0.88, midfield: 1, defence: 1.1, chanceQuality: 0.95 },
    blurb: 'The bus: a massive defensive block with a blunt, isolated attack.',
  },
  '4-2-4': {
    name: '4-2-4',
    bands: [
      { line: 'DEF', count: 4, y: 24 },
      { line: 'MID', count: 2, y: 46 },
      { line: 'FWD', count: 4, y: 78 },
    ],
    modifiers: { attack: 1.08, midfield: 0.9, defence: 0.97, chanceQuality: 1.03 },
    blurb: 'All-out attack. Midfield control — and with it possession — suffers.',
  },
  '3-4-3': {
    name: '3-4-3',
    bands: [
      { line: 'DEF', count: 3, y: 22 },
      { line: 'MID', count: 4, y: 48 },
      { line: 'FWD', count: 3, y: 78 },
    ],
    modifiers: { attack: 1.06, midfield: 1, defence: 0.94, chanceQuality: 1.02 },
    blurb: 'Aggressive width high up the pitch; risky behind the wing-backs.',
  },
  '4-5-1': {
    name: '4-5-1',
    bands: [
      { line: 'DEF', count: 4, y: 24 },
      { line: 'MID', count: 5, y: 48 },
      { line: 'FWD', count: 1, y: 82 },
    ],
    modifiers: { attack: 0.9, midfield: 1.08, defence: 1.03, chanceQuality: 0.96 },
    blurb: 'A packed midfield dominates the ball; the lone striker feeds on scraps.',
  },
  '5-1-4': {
    name: '5-1-4',
    bands: [
      { line: 'DEF', count: 5, y: 24 },
      { line: 'MID', count: 1, y: 46 },
      { line: 'FWD', count: 4, y: 78 },
    ],
    modifiers: { attack: 1.05, midfield: 0.88, defence: 1.04, chanceQuality: 0.98 },
    blurb: 'Wing-backs bomb past a lone pivot — direct, but easy to bypass in midfield.',
  },
}

/** The formations offered in the editor picker (a team's real formation is always added). */
export const PICKER_FORMATIONS: FormationName[] = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '3-5-2',
  '5-3-2',
  '5-4-1',
  '4-2-4',
  '3-4-3',
]

export const NO_MODIFIERS: FormationModifiers = { ...even }

export function formationOptions(realFormation: FormationName): FormationName[] {
  return PICKER_FORMATIONS.includes(realFormation)
    ? PICKER_FORMATIONS
    : [realFormation, ...PICKER_FORMATIONS]
}

/** One-line human summary of a formation's non-neutral modifiers. */
export function describeModifiers(name: FormationName): string {
  const m = FORMATIONS[name].modifiers
  const parts: string[] = []
  const fmt = (label: string, value: number) => `${label} ×${value.toFixed(2)}`
  if (m.attack !== 1) parts.push(fmt('attack', m.attack))
  if (m.midfield !== 1) parts.push(fmt('midfield/possession', m.midfield))
  if (m.defence !== 1) parts.push(fmt('defence', m.defence))
  if (m.chanceQuality !== 1) parts.push(fmt('chance quality', m.chanceQuality))
  return parts.length > 0 ? parts.join(' · ') : 'no modifiers'
}

// ── Slot layout ──────────────────────────────────────────────────────────────

function spread(count: number, margin: number): number[] {
  if (count === 1) return [50]
  const step = (100 - 2 * margin) / (count - 1)
  // Right to left, matching how lineups are listed (RB first, LB last).
  return Array.from({ length: count }, (_, i) => Math.round(100 - margin - i * step))
}

function defLabels(count: number): string[] {
  if (count === 3) return ['CB', 'CB', 'CB']
  if (count === 4) return ['RB', 'CB', 'CB', 'LB']
  return ['RWB', 'CB', 'CB', 'CB', 'LWB']
}

function midLabels(count: number): string[] {
  if (count <= 3) return Array.from({ length: count }, () => 'CM')
  const inner = Array.from({ length: count - 2 }, () => 'CM')
  return ['RM', ...inner, 'LM']
}

function fwdLabels(count: number): string[] {
  if (count === 1) return ['ST']
  if (count === 2) return ['ST', 'ST']
  if (count === 3) return ['RW', 'ST', 'LW']
  return ['RW', 'ST', 'ST', 'LW']
}

function bandLabels(band: FormationBand): string[] {
  if (band.labels) return band.labels
  if (band.line === 'DEF') return defLabels(band.count)
  if (band.line === 'MID') return midLabels(band.count)
  return fwdLabels(band.count)
}

const LINE_PREFIX: Record<Line, string> = { GK: 'gk', DEF: 'd', MID: 'm', FWD: 'f' }

/**
 * Lay out a formation's 11 slots. Slot ids number continuously per line
 * across bands (a 4-2-3-1's midfielders are m1..m5), so lineups survive
 * formation changes that keep line counts.
 */
export function formationSlots(name: FormationName): FormationSlot[] {
  const def = FORMATIONS[name]
  const slots: FormationSlot[] = [{ id: 'gk', line: 'GK', label: 'GK', x: 50, y: 6 }]
  const counters: Record<Line, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }

  for (const band of def.bands) {
    const margin = band.count >= 5 ? 9 : band.count === 4 ? 14 : band.line === 'MID' ? 26 : band.count === 1 ? 50 : 20
    const xs = spread(band.count, margin)
    const labels = bandLabels(band)
    // Wide players push slightly higher up the pitch than the central ones.
    const yOuter = band.count >= 3 ? band.y + (band.line === 'DEF' ? 2 : band.line === 'FWD' ? -4 : 2) : band.y
    for (let i = 0; i < band.count; i += 1) {
      counters[band.line] += 1
      slots.push({
        id: `${LINE_PREFIX[band.line]}${counters[band.line]}`,
        line: band.line,
        label: labels[i],
        x: xs[i],
        y: i === 0 || i === band.count - 1 ? yOuter : band.y,
      })
    }
  }
  return slots
}

// ── Auto-assignment when the formation changes ───────────────────────────────

const LINE_ORDER: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

function assignmentCost(natural: Line, slotLine: Line): number {
  if (natural === slotLine) return 0
  if (natural === 'GK' || slotLine === 'GK') return 10
  return Math.abs(LINE_ORDER[natural] - LINE_ORDER[slotLine])
}

/**
 * Re-seat the current XI into a new formation: each slot (GK first, then
 * defence upward) takes the still-unassigned player whose natural position
 * fits best, preserving the previous on-pitch order on ties. Always fills all
 * 11 slots with 11 distinct players.
 */
export function autoAssignFormation(
  orderedStarters: { playerId: string; natural: Line }[],
  formation: FormationName,
): Record<string, string> {
  const pool = orderedStarters.map((entry, index) => ({ ...entry, index }))
  const result: Record<string, string> = {}
  for (const slot of formationSlots(formation)) {
    let best = 0
    for (let i = 1; i < pool.length; i += 1) {
      const cost = assignmentCost(pool[i].natural, slot.line)
      const bestCost = assignmentCost(pool[best].natural, slot.line)
      if (cost < bestCost || (cost === bestCost && pool[i].index < pool[best].index)) best = i
    }
    result[slot.id] = pool[best].playerId
    pool.splice(best, 1)
  }
  return result
}
