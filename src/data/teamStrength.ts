import generated from './generated/team_strength.json'
import type { TeamId } from './teams'

/**
 * Fitted team strength from real international results (see pipeline/).
 * The Dixon-Coles-style parameters live in log-goal space; the engine works
 * on a ~0-99 ratings scale where its shot rate uses (attack/defence)^1.8.
 * Mapping rating = 75·exp(param/1.8) makes the engine's rate ratio equal the
 * fitted goal-rate ratio exactly, with the average international side at 75.
 */

const DATASET_NAME: Record<TeamId, string> = {
  PAR: 'Paraguay',
  FRA: 'France',
  CAN: 'Canada',
  MAR: 'Morocco',
  BRA: 'Brazil',
  NOR: 'Norway',
  MEX: 'Mexico',
  ENG: 'England',
  POR: 'Portugal',
  ESP: 'Spain',
  USA: 'United States',
  BEL: 'Belgium',
  ARG: 'Argentina',
  EGY: 'Egypt',
  SUI: 'Switzerland',
  COL: 'Colombia',
}

const ENGINE_MEAN = 75
const RATE_POWER = 1.8 // must match TUNING.attackDefencePower in the engine

export interface TeamBaseline {
  /** Engine-scale baseline attack/defence for the real squad. */
  attack: number
  defence: number
  /** Fitted log-space parameters and fit provenance. */
  raw: { attack: number; defence: number; matches: number; lastMatch: string }
}

export function baselineFor(teamId: TeamId): TeamBaseline {
  const entry = generated.teams[DATASET_NAME[teamId] as keyof typeof generated.teams]
  if (!entry) throw new Error(`No fitted strength for ${teamId} (${DATASET_NAME[teamId]})`)
  return {
    attack: ENGINE_MEAN * Math.exp(entry.attack / RATE_POWER),
    defence: ENGINE_MEAN * Math.exp(entry.defence / RATE_POWER),
    raw: {
      attack: entry.attack,
      defence: entry.defence,
      matches: entry.matches,
      lastMatch: entry.lastMatch,
    },
  }
}

export const TEAM_STRENGTH_META = generated.meta
