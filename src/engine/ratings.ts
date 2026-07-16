import type {
  Line,
  OutOfPositionFlag,
  PlayerRatings,
  SlotAssignment,
  TeamSheet,
  TeamStrength,
} from './types'

const LINE_ORDER: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

/**
 * Multiplier applied to a player's ratings when they occupy a slot outside
 * their natural line. A goalkeeper outfield (or an outfielder in goal) is
 * nearly unusable; a striker at centre-back is badly blunted; adjacent lines
 * (e.g. midfielder up front) cost less.
 */
export function positionPenalty(natural: Line, slotLine: Line): number {
  if (natural === slotLine) return 1
  if (natural === 'GK' || slotLine === 'GK') return 0.4
  const distance = Math.abs(LINE_ORDER[natural] - LINE_ORDER[slotLine])
  return distance === 1 ? 0.75 : 0.6
}

export interface EffectiveRatings {
  pace: number
  shooting: number
  passing: number
  defending: number
  physical: number
  penalty: number
}

export function effectiveRatings(ratings: PlayerRatings, slotLine: Line): EffectiveRatings {
  const penalty = positionPenalty(ratings.position, slotLine)
  return {
    pace: ratings.pace * penalty,
    shooting: ratings.shooting * penalty,
    passing: ratings.passing * penalty,
    defending: ratings.defending * penalty,
    physical: ratings.physical * penalty,
    penalty,
  }
}

/** How much each slot line contributes to a phase of play. */
const ATTACK_LINE_WEIGHT: Record<Line, number> = { GK: 0, DEF: 0.2, MID: 0.55, FWD: 1 }
const MIDFIELD_LINE_WEIGHT: Record<Line, number> = { GK: 0, DEF: 0.4, MID: 1, FWD: 0.4 }
const DEFENCE_LINE_WEIGHT: Record<Line, number> = { GK: 0.9, DEF: 1, MID: 0.5, FWD: 0.1 }

function attackRating(r: EffectiveRatings): number {
  return r.shooting * 0.5 + r.pace * 0.3 + r.passing * 0.2
}

function midfieldRating(r: EffectiveRatings): number {
  return r.passing * 0.6 + r.physical * 0.25 + r.pace * 0.15
}

function defenceRating(r: EffectiveRatings): number {
  return r.defending * 0.6 + r.physical * 0.25 + r.pace * 0.15
}

function weightedMean(entries: { value: number; weight: number }[]): number {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight === 0) return 0
  return entries.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight
}

export function outOfPositionFlags(starters: SlotAssignment[]): OutOfPositionFlag[] {
  return starters
    .filter(({ slot, player }) => player.ratings.position !== slot.line)
    .map(({ slot, player }) => ({
      playerId: player.id,
      playerName: player.name,
      slotId: slot.id,
      slotLabel: slot.label,
      naturalLine: player.ratings.position,
      slotLine: slot.line,
      penalty: positionPenalty(player.ratings.position, slot.line),
    }))
}

/**
 * Aggregate the 11 on-pitch players into phase ratings (0-99 scale). Players
 * contribute to each phase according to the line of the slot they occupy, with
 * out-of-position penalties already applied to their ratings.
 */
export function computeTeamStrength(starters: SlotAssignment[]): TeamStrength {
  const rated = starters.map(({ slot, player }) => ({
    slot,
    eff: effectiveRatings(player.ratings, slot.line),
  }))

  const attack = weightedMean(
    rated.map(({ slot, eff }) => ({ value: attackRating(eff), weight: ATTACK_LINE_WEIGHT[slot.line] })),
  )
  const midfield = weightedMean(
    rated.map(({ slot, eff }) => ({ value: midfieldRating(eff), weight: MIDFIELD_LINE_WEIGHT[slot.line] })),
  )
  const defence = weightedMean(
    rated.map(({ slot, eff }) => ({ value: defenceRating(eff), weight: DEFENCE_LINE_WEIGHT[slot.line] })),
  )

  const gk = rated.find(({ slot }) => slot.line === 'GK')
  // A keeper's shot-stopping is proxied by defending; an outfielder in goal
  // already carries the heavy GK position penalty.
  const goalkeeping = gk ? gk.eff.defending * 0.8 + gk.eff.physical * 0.2 : 30

  return { attack, midfield, defence, goalkeeping, flags: outOfPositionFlags(starters) }
}

/** Multiply phase ratings by a formation's modifiers (goalkeeping is shape-independent). */
export function applyFormationEffect(strength: TeamStrength, effect: TeamSheet['modifiers']): TeamStrength {
  if (!effect) return strength
  return {
    ...strength,
    attack: strength.attack * effect.attack,
    midfield: strength.midfield * effect.midfield,
    defence: strength.defence * effect.defence,
  }
}

/**
 * Anchor a lineup's aggregate to the team's results-fitted baseline: attack
 * and defence become baseline × (current aggregate ÷ real-XI aggregate).
 * With the real XI in the real formation the ratio is 1 and the baseline is
 * reproduced exactly. Midfield and goalkeeping stay player-derived (the
 * results model has no midfield/keeper signal).
 */
export function computeAnchoredStrength(sheet: TeamSheet, starters: SlotAssignment[] = sheet.starters): TeamStrength {
  const players = applyFormationEffect(computeTeamStrength(starters), sheet.modifiers)
  if (!sheet.anchor) return players
  return {
    ...players,
    attack: sheet.anchor.attack * (players.attack / sheet.anchor.reference.attack),
    defence: sheet.anchor.defence * (players.defence / sheet.anchor.reference.defence),
  }
}

/** The strength the engine actually plays with: results baseline, shifted by the lineup. */
export function computeSheetStrength(sheet: TeamSheet): TeamStrength {
  return computeAnchoredStrength(sheet)
}
