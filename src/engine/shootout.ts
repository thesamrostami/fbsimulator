import { createCommentator, type Commentator } from './commentary'
import { SHOOTOUT_BASE_CONVERSION } from './empirical'
import type { Rng } from './rng'
import type { PenDirection, PenaltyKick, Player, ShootoutResult, Side, SlotAssignment } from './types'

/**
 * Penalty shootout: five kicks each, then sudden death. Pure and seeded like
 * the rest of the engine. Conversion odds come from the shooter's shooting
 * rating against the opposing keeper's quality.
 */

const DIRECTIONS: readonly PenDirection[] = ['left', 'center', 'right']

/** Chance a missed (non-scored) kick was stopped by the keeper rather than off target. */
const SAVED_SHARE = 0.78
/** Hard cap on sudden-death rounds; the final capped round is forced decisive. */
const MAX_SUDDEN_DEATH_ROUNDS = 30

export function conversionChance(shooting: number, keeperQuality: number): number {
  const raw = SHOOTOUT_BASE_CONVERSION + (shooting - 75) / 260 - (keeperQuality - 78) / 320
  return Math.min(0.92, Math.max(0.42, raw))
}

/** Kick order: best shooters first, the goalkeeper last of all. */
export function shootoutTakers(onPitch: SlotAssignment[]): Player[] {
  const players = onPitch.map((a) => a.player)
  const outfield = players.filter((pl) => pl.ratings.position !== 'GK')
  const keepers = players.filter((pl) => pl.ratings.position === 'GK')
  outfield.sort((a, b) => b.ratings.shooting - a.ratings.shooting)
  return [...outfield, ...keepers]
}

interface ShootoutSideInput {
  takers: Player[]
  /** This side's own keeper quality — applied against the opponent's kicks. */
  goalkeeping: number
}

interface KickState {
  side: Side
  taken: number
  scored: number
  takers: Player[]
  opponentKeeper: number
}

function takeKick(rng: Rng, commentary: Commentator, state: KickState, pressure: boolean, forced?: boolean): PenaltyKick {
  const player = state.takers[state.taken % state.takers.length]
  const direction = rng.pick(DIRECTIONS)
  let dive = rng.weightedPick(DIRECTIONS, (d) => (d === 'center' ? 0.2 : 0.4))
  const chance = conversionChance(player.ratings.shooting, state.opponentKeeper)
  const scored = forced ?? rng.chance(chance)
  let saved = false
  if (!scored) {
    saved = rng.chance(SAVED_SHARE)
    if (saved) dive = direction
  }
  state.taken += 1
  if (scored) state.scored += 1
  const line = commentary.line(scored ? 'pen-scored' : saved ? 'pen-saved' : 'pen-missed', {
    player: player.name,
    odds: chance,
    tags: pressure ? ['pressure'] : [],
  })
  return {
    side: state.side,
    player,
    scored,
    direction,
    dive,
    saved,
    chance,
    pressure,
    commentary: line,
    scoreAfter: { home: 0, away: 0 },
  }
}

export function simulateShootout(
  rng: Rng,
  home: ShootoutSideInput,
  away: ShootoutSideInput,
  commentary: Commentator = createCommentator(rng),
): ShootoutResult {
  const kicks: PenaltyKick[] = []
  const h: KickState = { side: 'home', taken: 0, scored: 0, takers: home.takers, opponentKeeper: away.goalkeeping }
  const a: KickState = { side: 'away', taken: 0, scored: 0, takers: away.takers, opponentKeeper: home.goalkeeping }

  const record = (kick: PenaltyKick) => {
    kick.scoreAfter = { home: h.scored, away: a.scored }
    kicks.push(kick)
  }

  // Best of five: stop as soon as the trailing side can no longer catch up.
  const decidedInRegulation = () => {
    const hRemaining = 5 - h.taken
    const aRemaining = 5 - a.taken
    return h.scored > a.scored + aRemaining || a.scored > h.scored + hRemaining
  }

  // A regulation kick is must-score when a miss guarantees defeat: the
  // opponent's tally already meets or beats everything we could still reach.
  const mustScore = (own: KickState, opp: KickState) => opp.scored >= own.scored + (5 - own.taken)

  for (let round = 0; round < 5 && !decidedInRegulation(); round += 1) {
    record(takeKick(rng, commentary, h, mustScore(h, a)))
    if (decidedInRegulation()) break
    record(takeKick(rng, commentary, a, mustScore(a, h)))
  }

  // Sudden death, one pair at a time: the second kicker is under pressure
  // whenever the first scored (a miss loses it). The capped final round is
  // forced decisive so a shootout always produces a winner.
  let round = 0
  while (h.scored === a.scored) {
    round += 1
    const forced = round >= MAX_SUDDEN_DEATH_ROUNDS
    const first = takeKick(rng, commentary, h, false, forced ? true : undefined)
    record(first)
    record(takeKick(rng, commentary, a, first.scored, forced ? false : undefined))
  }

  return {
    kicks,
    score: { home: h.scored, away: a.scored },
    winner: h.scored > a.scored ? 'home' : 'away',
  }
}
