import type { CommentaryTag } from './commentary'
import { EMPIRICAL_ON_TARGET_GIVEN_MISS, goalMinuteFactor } from './empirical'
import { clamp01, cornerSpot, distanceToGoal, inBox, laneOf, locationXg, mirror, PENALTY_SPOT, thirdOf } from './pitch'
import { positionPenalty } from './ratings'
import { conversionChance } from './shootout'
import { playerStatsFor, zoneIndex, type EngineContext, type SideState } from './state'
import type {
  BallAction,
  BallPathPoint,
  ChanceSource,
  MatchEvent,
  PitchPoint,
  Player,
  PossessionSequence,
  Score,
  SequenceOutcome,
  SlotAssignment,
} from './types'
import { BIG_CHANCE_XG } from './types'

/**
 * The possession engine. A possession is a chain of contested steps in the
 * attacking side's frame: build out of the defensive third, progress through
 * the middle, break into the final third and shoot — or lose it, get fouled,
 * or win a corner along the way. Each step is a real contest between the
 * players covering that zone, scaled by the results-fitted team strengths so
 * the calibrated goal rates survive: a from-the-back attack faces the anchored
 * attack/defence ratio to the same total power (1.8) the old per-minute shot
 * roll used, spread across its stages.
 */
export const POSSESSION = {
  /** Stage base success at even strength: build-out, progression, final-third entry. */
  buildOut: 0.72,
  progress: 0.38,
  entry: 0.25,
  /** Exponents on the anchored attack/defence ratio per stage. */
  buildOutPower: 0.3,
  progressPower: 0.5,
  entryPower: 1.0,
  /** Player-level modulation: the ratio of the zone groups' quality, and midfield vs midfield. */
  zonePower: 0.35,
  midfieldPower: 0.2,
  maxSteps: 5,
  /** A turnover in the opponent's half becomes a fast break this often (× tactics). */
  counterChance: 0.35,
  fastBreakStep: 1.25,
  fastBreakXg: 1.25,
  fastBreakSteps: 3,
  /** A failed final-third entry becomes a long-range effort this often. */
  longShotChance: 0.15,
  /** Fouls. Contest rates are per step; the box rate is per entry attempt. */
  foulChance: 0.11,
  offensiveFoulChance: 0.03,
  boxFoulChance: 0.006,
  yellowGivenFoul: 0.145,
  redGivenFoul: 0.003,
  yellowGivenPenaltyFoul: 0.45,
  /** Share of would-be second yellows actually shown: booked players tread carefully. */
  secondYellowScale: 0.1,
  /** Shot outcomes. */
  blockedShare: 0.28,
  headerBlockedShare: 0.15,
  cornerFromBlock: 0.4,
  cornerFromSave: 0.3,
  cornerFromFailedEntry: 0.2,
  cornerFromClearance: 0.1,
  cornerShotChance: 0.36,
  /** Direct free kicks are taken from inside this range (attacking-frame x, |y − 0.5|). */
  freeKickRangeX: 0.7,
  freeKickRangeY: 0.28,
  freeKickDirectChance: 0.55,
  /** Situation multipliers on location xG. */
  headerXg: 0.7,
  throughBallXg: 1.6,
  cutbackXg: 1.15,
  freeKickXg: 0.55,
  cornerHeaderXg: 0.8,
  /**
   * Global scale on every chance's xG so the mean matches the empirical
   * knockout xG per shot (StatsBomb WC2022, see empirical.ts) — measured
   * from the unscaled location model over the 16 fixtures.
   */
  xgScale: 0.8,
  minXg: 0.01,
  maxXg: 0.9,
} as const

type EntryKind = 'pass' | 'carry' | 'through-ball' | 'cross' | 'cutback'

export interface MinuteFactors {
  /** Extra-time fatigue: chance creation up. */
  shotBoost: number
  /** Extra-time fatigue: fouls and cards up. */
  cardBoost: number
  /** Momentum boost for the attacking side at this minute. */
  momentum: number
  /** Home possession share this minute (for reasoning text). */
  possession: number
}

export interface PossessionResult {
  outcome: SequenceOutcome
  /** Where the possession ended, in the attacker's frame. */
  end: PitchPoint
  /** The opponent won the ball live and may break. */
  counterable: boolean
  /** The attackers have a corner to take next. */
  corner: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function score(ctx: EngineContext): Score {
  return { home: ctx.home.goals, away: ctx.away.goals }
}

function playerTags(player: Player, slotLine: SlotAssignment['slot']['line']): CommentaryTag[] {
  const tags: CommentaryTag[] = []
  const r = player.ratings
  if (Math.max(r.pace, r.shooting, r.passing, r.defending, r.physical) >= 88) tags.push('star')
  if (r.position !== slotLine) tags.push('outOfPosition')
  return tags
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function describeSpot(p: PitchPoint): string {
  const dist = Math.round(distanceToGoal(p))
  const lane = laneOf(p.y)
  const where = inBox(p) ? 'inside the box' : lane === 'centre' ? 'from central territory' : `from the ${lane}`
  return `${dist} m out, ${where}`
}

// ── The possession runner ───────────────────────────────────────────────────

interface Runner {
  ctx: EngineContext
  attacker: SideState
  defender: SideState
  minute: number
  factors: MinuteFactors
  source: ChanceSource
  fastBreak: boolean
  points: BallPathPoint[]
  /** Player on the ball (index into attacker.profile.players). */
  carrier: number
  /** Whoever made the last completed pass-type action, for assists and key passes. */
  lastPasser: number
  /** Number of passes completed in this possession, for the story. */
  passes: number
  seqIndex: number
}

/** Per-stage multiplier that every contested step shares. */
function stageFactor(r: Runner, power: number, p: PitchPoint): number {
  const { attacker, defender } = r
  const ratio = attacker.strength.attack / Math.max(defender.strength.defence, 1)
  const z = zoneIndex(p)
  const zoneRatio = attacker.profile.progress[z] / Math.max(defender.profile.defence[z], 1)
  return Math.pow(ratio, power) * Math.pow(zoneRatio, POSSESSION.zonePower) * attacker.tactics.progression
}

/** Momentum, fatigue and the empirical minute-of-goal curve, shared by the sharp-end stages. */
function tempoFactor(r: Runner): number {
  return Math.sqrt(goalMinuteFactor(r.minute) * r.factors.momentum * r.factors.shotBoost)
}

function pushPoint(r: Runner, p: PitchPoint, playerIndex: number | undefined, action: BallAction): void {
  r.points.push({
    t: 0, // assigned when the minute closes
    x: round2(p.x),
    y: round2(p.y),
    playerId: playerIndex !== undefined ? r.attacker.profile.players[playerIndex]?.player.id : undefined,
    action,
  })
}

function pickCarrier(r: Runner, p: PitchPoint): number {
  return r.ctx.rng.weightedIndex(r.attacker.profile.carrier[zoneIndex(p)])
}

function pickDefender(r: Runner, p: PitchPoint): number {
  return r.ctx.rng.weightedIndex(r.defender.profile.defender[zoneIndex(p)])
}

/** A completed pass/carry: stats for the player who made it. */
function creditStep(r: Runner, from: number, kind: BallAction): void {
  const players = r.attacker.profile.players
  const passer = playerStatsFor(r.ctx, players[from].player.id, r.attacker.side)
  if (kind === 'carry') {
    passer.carries += 1
  } else {
    passer.passes += 1
    passer.passesCompleted += 1
    r.attacker.stats.passes += 1
    r.attacker.stats.passesCompleted += 1
    r.lastPasser = from
    r.passes += 1
  }
}

function creditTurnover(r: Runner, p: PitchPoint, kind: BallAction): number {
  const players = r.attacker.profile.players
  const loser = playerStatsFor(r.ctx, players[r.carrier].player.id, r.attacker.side)
  if (kind !== 'carry') {
    loser.passes += 1
    r.attacker.stats.passes += 1
  }
  const d = pickDefender(r, p)
  const winner = r.defender.profile.players[d]
  if (winner) playerStatsFor(r.ctx, winner.player.id, r.defender.side).tackles += 1
  return d
}

// ── Fouls and cards ─────────────────────────────────────────────────────────

function foulReasoning(r: Runner, fouler: Player, rate: number, penaltyFoul: boolean): string {
  const tired = r.factors.cardBoost > 1 ? `; extra-time fatigue raises the foul and card risk ×${r.factors.cardBoost}` : ''
  return (
    `${fouler.name} is a likely fouler here (defending ${fouler.ratings.defending}, physical ${fouler.ratings.physical}` +
    `; ${r.defender.sheet.name} foul on ${(rate * 100).toFixed(1)}% of contests in this zone${tired})` +
    (penaltyFoul ? '. A foul that stops a chance in the box is booked far more often.' : '.')
  )
}

/**
 * Show a card for a foul, if any. Reds remove the player (the caller has
 * already reacted to the foul itself). Returns whether a red was shown.
 */
function cardFor(r: Runner, side: SideState, playerIndex: number, p: PitchPoint, penaltyFoul: boolean, rate: number): void {
  const { ctx, minute } = r
  const assignment = side.profile.players[playerIndex]
  if (!assignment) return
  const { player } = assignment
  const stats = playerStatsFor(ctx, player.id, side.side)
  stats.fouls += 1
  side.stats.fouls += 1

  const yellowChance = (penaltyFoul ? POSSESSION.yellowGivenPenaltyFoul : POSSESSION.yellowGivenFoul) * r.factors.cardBoost
  const redChance = POSSESSION.redGivenFoul * r.factors.cardBoost
  const spot = { x: round2(p.x), y: round2(p.y) }
  const reds = () => `${side.sheet.name} drop to ${side.onPitch.length} players.`

  if (ctx.rng.chance(redChance)) {
    r.ctx.sendOff(side, player)
    stats.red = true
    ctx.events.push({
      minute,
      type: 'red-card',
      side: side.side,
      teamId: side.sheet.teamId,
      player,
      spot,
      sequence: r.seqIndex,
      score: score(ctx),
      commentary: ctx.commentary.lineAt('red-card', minute, { player: player.name, team: side.sheet.name }),
      reasoning: `Straight red (${(redChance * 100).toFixed(2)}% of fouls). ${foulReasoning(r, player, rate, penaltyFoul)} ${reds()}`,
    })
    return
  }
  if (!ctx.rng.chance(yellowChance)) return

  const prior = side.yellowsByPlayer.get(player.id) ?? 0
  // A booked player tackles more carefully: a second yellow is rarer per foul.
  if (prior >= 1 && !ctx.rng.chance(POSSESSION.secondYellowScale)) return
  if (prior >= 1) {
    r.ctx.sendOff(side, player)
    stats.red = true
    ctx.events.push({
      minute,
      type: 'red-card',
      side: side.side,
      teamId: side.sheet.teamId,
      player,
      spot,
      sequence: r.seqIndex,
      score: score(ctx),
      commentary: ctx.commentary.lineAt('red-card', minute, { player: player.name, team: side.sheet.name }),
      reasoning: `Second yellow for ${player.name} → red. ${foulReasoning(r, player, rate, penaltyFoul)} ${reds()}`,
    })
    return
  }
  side.yellowsByPlayer.set(player.id, prior + 1)
  side.stats.yellows += 1
  stats.yellows += 1
  ctx.events.push({
    minute,
    type: 'yellow-card',
    side: side.side,
    teamId: side.sheet.teamId,
    player,
    spot,
    sequence: r.seqIndex,
    score: score(ctx),
    commentary: ctx.commentary.lineAt('yellow-card', minute, { player: player.name }),
    reasoning: `Booking (${Math.round(yellowChance * 100)}% of fouls). ${foulReasoning(r, player, rate, penaltyFoul)} A second yellow would mean red.`,
  })
}

/** A defensive foul on the man in possession at p. Returns true when one happened. */
function defensiveFoul(r: Runner, p: PitchPoint): boolean {
  const { defender, attacker, ctx } = r
  if (defender.onPitch.length <= 1) return false
  const z = zoneIndex(p)
  const rate =
    POSSESSION.foulChance * defender.tactics.fouls * r.factors.cardBoost * (defender.profile.aggression[z] / 75)
  if (!ctx.rng.chance(rate)) return false
  const fouler = pickDefender(r, p)
  const victim = attacker.profile.players[r.carrier]
  if (victim) playerStatsFor(ctx, victim.player.id, attacker.side).foulsWon += 1
  cardFor(r, defender, fouler, mirror(p), false, rate)
  return true
}

/** The man in possession fouls a defender: the ball turns over. */
function offensiveFoul(r: Runner, p: PitchPoint): boolean {
  const { attacker, ctx } = r
  const rate = POSSESSION.offensiveFoulChance * attacker.tactics.fouls * r.factors.cardBoost
  if (!ctx.rng.chance(rate)) return false
  const d = pickDefender(r, p)
  const victim = r.defender.profile.players[d]
  if (victim) playerStatsFor(ctx, victim.player.id, r.defender.side).foulsWon += 1
  cardFor(r, attacker, r.carrier, p, false, rate)
  return true
}

// ── Shots ───────────────────────────────────────────────────────────────────

interface ShotSetup {
  spot: PitchPoint
  shooter: number
  /** Index of the assisting player, when the chance was created by a pass. */
  assist?: number
  header: boolean
  /** Multiplier on location xG for the situation. */
  situation: number
  situationNote: string
  source: ChanceSource
  /** Fixed conversion odds (penalties) instead of the location model. */
  fixedXg?: number
}

function shooterFor(r: Runner, spot: PitchPoint, header: boolean): number {
  const z = zoneIndex(spot)
  return r.ctx.rng.weightedIndex(header ? r.attacker.profile.header[z] : r.attacker.profile.shooter[z])
}

/** Resolve a shot: xG, the roll, stats, the event. Returns whether a corner resulted. */
function takeShot(r: Runner, setup: ShotSetup): { goal: boolean; corner: boolean } {
  const { ctx, attacker, defender, minute } = r
  const { rng, events } = ctx
  const assignment = attacker.profile.players[setup.shooter]
  const { slot, player } = assignment
  const assistPlayer = setup.assist !== undefined && setup.assist !== setup.shooter ? attacker.profile.players[setup.assist]?.player : undefined

  const penalty = positionPenalty(player.ratings.position, slot.line)
  const shooterFactor = clamp(Math.pow((player.ratings.shooting * penalty) / 80, 0.6), 0.7, 1.25)
  const shapeQuality = attacker.sheet.modifiers?.chanceQuality ?? 1
  const concededFactor = setup.header || setup.source === 'corner' ? defender.tactics.crossConceded : defender.tactics.centralConceded

  let xg: number
  let locationNote: string
  if (setup.fixedXg !== undefined) {
    xg = setup.fixedXg
    locationNote = `from the spot, conversion odds ${Math.round(xg * 100)}% (taker's shooting ${player.ratings.shooting} vs keeper quality ${Math.round(defender.strength.goalkeeping)})`
  } else {
    const loc = locationXg(setup.spot)
    xg = clamp(loc * setup.situation * shooterFactor * shapeQuality * concededFactor * POSSESSION.xgScale, POSSESSION.minXg, POSSESSION.maxXg)
    locationNote =
      `${describeSpot(setup.spot)}: location xG ${loc.toFixed(2)}` +
      (setup.situation !== 1 ? `, ${setup.situationNote} ×${setup.situation.toFixed(2)}` : '') +
      `, ${player.name} shooting ${player.ratings.shooting}` +
      (penalty < 1 ? ` (reduced ×${penalty.toFixed(2)} for playing ${slot.label} out of position)` : '') +
      ` ×${shooterFactor.toFixed(2)}` +
      (shapeQuality !== 1 && attacker.sheet.formation ? `, ${attacker.sheet.formation} shape ×${shapeQuality.toFixed(2)}` : '') +
      (concededFactor !== 1 ? `, opponents' compactness ×${concededFactor.toFixed(2)}` : '')
  }

  attacker.stats.shots += 1
  attacker.stats.xg += xg
  if (xg >= BIG_CHANCE_XG) attacker.stats.bigChances += 1
  const shooterStats = playerStatsFor(ctx, player.id, attacker.side)
  shooterStats.shots += 1
  shooterStats.xg += xg
  if (assistPlayer) {
    const creator = playerStatsFor(ctx, assistPlayer.id, attacker.side)
    creator.keyPasses += 1
    creator.xa += xg
  }

  const possessionPct = Math.round((attacker.side === 'home' ? r.factors.possession : 1 - r.factors.possession) * 100)
  const story =
    setup.source === 'penalty'
      ? 'Penalty.'
      : setup.source === 'corner'
        ? 'From a corner.'
        : setup.source === 'free-kick'
          ? 'Direct free kick.'
          : `${r.fastBreak ? 'Fast break' : 'Open play'}, ${r.passes} pass${r.passes === 1 ? '' : 'es'} in the move` +
            (assistPlayer ? `, set up by ${assistPlayer.name}` : '') +
            '.'
  const chanceContext =
    `Chance for ${attacker.sheet.name}: attack ${Math.round(attacker.strength.attack)} vs defence ${Math.round(defender.strength.defence)}` +
    `, possession weight ${possessionPct}%` +
    (r.factors.shotBoost > 1 ? `, extra-time fatigue ×${r.factors.shotBoost}` : '') +
    `. ${story} Shot ${locationNote} → xG ${xg.toFixed(2)}.`

  const gkFactor = clamp(1 - (defender.strength.goalkeeping - 75) / 150, 0.7, 1.15)
  const conversionContext =
    ` Conversion odds ${Math.round(xg * gkFactor * 100)}% against keeper quality ${Math.round(defender.strength.goalkeeping)} (factor ×${gkFactor.toFixed(2)})`
  const baseTags = playerTags(player, slot.line)
  if (setup.header) baseTags.push('header')
  if (r.fastBreak) baseTags.push('counter')
  if (setup.source === 'corner' || setup.source === 'free-kick') baseTags.push('setPiece')
  if (setup.situation >= POSSESSION.throughBallXg) baseTags.push('oneOnOne')
  if (setup.source !== 'penalty' && !inBox(setup.spot)) baseTags.push('longRange')
  if (assistPlayer) baseTags.push('assisted')

  const spot = { x: round2(setup.spot.x), y: round2(setup.spot.y) }
  const common = {
    minute,
    side: attacker.side,
    teamId: attacker.sheet.teamId,
    player,
    assist: assistPlayer,
    xg: round2(xg),
    spot,
    source: setup.source,
    header: setup.header || undefined,
    sequence: r.seqIndex,
  }
  const ctxNames = {
    player: player.name,
    assist: assistPlayer?.name,
    team: attacker.sheet.name,
    opponent: defender.sheet.name,
    xg,
    odds: setup.fixedXg,
  }

  if (rng.chance(xg * gkFactor)) {
    const diffBefore = attacker.goals - defender.goals
    attacker.goals += 1
    attacker.stats.goals += 1
    attacker.stats.onTarget += 1
    shooterStats.goals += 1
    shooterStats.onTarget += 1
    if (assistPlayer) playerStatsFor(ctx, assistPlayer.id, attacker.side).assists += 1
    ctx.onGoal(attacker, defender, minute)
    const diffAfter = attacker.goals - defender.goals
    const tags: CommentaryTag[] = [...baseTags]
    if (diffAfter === 0) tags.push('equalizer')
    if (diffAfter > 0 && diffBefore <= 0) tags.push('goAhead')
    if (diffAfter < 0) tags.push('consolation')
    if ((diffAfter === 0 || (diffAfter > 0 && diffBefore <= 0)) && attacker.maxDeficit >= 2) tags.push('comeback')
    if (minute >= 85) tags.push('lateDrama')
    if (attacker.underdog) tags.push('underdog')
    events.push({
      ...common,
      type: 'goal',
      score: score(ctx),
      commentary: ctx.commentary.lineAt(setup.source === 'penalty' ? 'pen-scored' : 'goal', minute, {
        ...ctxNames,
        score: `${attacker.goals}–${defender.goals}`,
        tags,
      }),
      reasoning: `${chanceContext}${conversionContext} — roll passed: GOAL.`,
    })
    return { goal: true, corner: false }
  }

  // Not a goal: blocked by a body, kept out by the keeper, or off target.
  const blockedShare = setup.fixedXg !== undefined ? 0 : setup.header ? POSSESSION.headerBlockedShare : POSSESSION.blockedShare
  const blocked = rng.chance(blockedShare)
  const onTarget = !blocked && rng.chance(EMPIRICAL_ON_TARGET_GIVEN_MISS / Math.max(1 - blockedShare, 1e-6))
  let corner = false
  let type: MatchEvent['type']
  if (blocked) {
    type = 'shot-blocked'
    attacker.stats.blocked += 1
    corner = rng.chance(POSSESSION.cornerFromBlock)
    const blocker = pickDefender(r, setup.spot)
    const blockerPlayer = defender.profile.players[blocker]
    if (blockerPlayer) playerStatsFor(ctx, blockerPlayer.player.id, defender.side).tackles += 1
  } else if (onTarget) {
    type = 'shot-saved'
    attacker.stats.onTarget += 1
    shooterStats.onTarget += 1
    corner = rng.chance(POSSESSION.cornerFromSave)
    const gk = defender.profile.players[defender.profile.gkIndex]
    if (gk) playerStatsFor(ctx, gk.player.id, defender.side).saves += 1
  } else {
    type = 'shot-miss'
  }
  const penaltyType = setup.source === 'penalty' ? (onTarget ? 'pen-saved' : 'pen-missed') : type
  events.push({
    ...common,
    type,
    score: score(ctx),
    commentary: ctx.commentary.lineAt(penaltyType, minute, { ...ctxNames, tags: baseTags }),
    reasoning:
      `${chanceContext}${conversionContext} — roll failed: ${blocked ? 'blocked' : onTarget ? 'saved' : 'off target'}` +
      (corner ? ', out for a corner.' : '.'),
  })
  return { goal: false, corner }
}

// ── Chance construction ─────────────────────────────────────────────────────

function chooseEntryKind(r: Runner, p: PitchPoint): EntryKind {
  const { rng } = r.ctx
  const lane = laneOf(p.y)
  if (lane !== 'centre') {
    const crossShare = Math.min(r.attacker.tactics.crossShare * 1.6, 0.8)
    const u = rng.next()
    if (u < crossShare) return 'cross'
    if (u < crossShare + (1 - crossShare) * 0.55) return 'cutback'
    return 'carry'
  }
  const u = rng.next()
  if (u < 0.3) return 'through-ball'
  if (u < 0.75) return 'pass'
  return 'carry'
}

function shotSpotFor(r: Runner, kind: EntryKind, from: PitchPoint): PitchPoint {
  const { rng } = r.ctx
  const range = (a: number, b: number) => a + (b - a) * rng.next()
  const around = (sigma: number) => clamp01(0.5 + rng.gaussian() * sigma)
  switch (kind) {
    case 'through-ball':
      return { x: range(0.84, 0.94), y: around(0.09) }
    case 'cross':
      return { x: range(0.87, 0.95), y: around(0.1) }
    case 'cutback':
      return { x: range(0.8, 0.88), y: around(0.11) }
    case 'pass':
      return { x: range(0.76, 0.91), y: around(0.14) }
    case 'carry':
      return { x: range(0.74, 0.88), y: clamp01(from.y + rng.gaussian() * 0.12) }
  }
}

function situationFor(r: Runner, kind: EntryKind, header: boolean): { mult: number; note: string } {
  let mult = 1
  const notes: string[] = []
  if (header) {
    mult *= POSSESSION.headerXg
    notes.push('header')
  }
  if (kind === 'through-ball') {
    mult *= POSSESSION.throughBallXg
    notes.push('through on goal')
  }
  if (kind === 'cutback') {
    mult *= POSSESSION.cutbackXg
    notes.push('cut-back')
  }
  if (r.fastBreak) {
    mult *= POSSESSION.fastBreakXg
    notes.push('fast break')
  }
  return { mult, note: notes.join(', ') }
}

/** A penalty: awarded, then taken by the best taker on the pitch. */
function penalty(r: Runner, p: PitchPoint, rate: number): void {
  const { ctx, attacker, defender, minute } = r
  const fouler = pickDefender(r, p)
  const foulerPlayer = defender.profile.players[fouler]?.player
  const victim = attacker.profile.players[r.carrier]
  if (victim) playerStatsFor(ctx, victim.player.id, attacker.side).foulsWon += 1
  attacker.stats.penalties += 1
  ctx.events.push({
    minute,
    type: 'penalty',
    side: attacker.side,
    teamId: attacker.sheet.teamId,
    player: foulerPlayer,
    spot: { x: PENALTY_SPOT.x, y: PENALTY_SPOT.y },
    sequence: r.seqIndex,
    score: score(ctx),
    commentary: ctx.commentary.lineAt('penalty', minute, {
      player: foulerPlayer?.name,
      opponent: victim?.player.name,
      team: attacker.sheet.name,
    }),
    reasoning:
      `Foul inside the box (${(rate * 100).toFixed(1)}% of entries into the area against ${defender.sheet.name}` +
      (defender.tactics.fouls !== 1 ? `, tactics ×${defender.tactics.fouls.toFixed(2)}` : '') +
      `). ${foulerPlayer ? foulerPlayer.name + ' is the man who gave it away.' : ''}`,
  })
  cardFor(r, defender, fouler, mirror(p), true, rate)
  pushPoint(r, PENALTY_SPOT, attacker.profile.penaltyTaker, 'shot')
  const taker = attacker.profile.penaltyTaker
  const takerPlayer = attacker.profile.players[taker].player
  takeShot(r, {
    spot: PENALTY_SPOT,
    shooter: taker,
    header: false,
    situation: 1,
    situationNote: '',
    source: 'penalty',
    fixedXg: conversionChance(takerPlayer.ratings.shooting, defender.strength.goalkeeping),
  })
}

/** The final-third stage: try to break in and shoot. Returns the possession's outcome. */
function finalThird(r: Runner, p: PitchPoint): { outcome: SequenceOutcome; end: PitchPoint; corner: boolean } {
  const { ctx, attacker, defender } = r
  const { rng } = ctx

  // A foul in the box while breaking in: penalty.
  if (defender.onPitch.length > 1) {
    const boxRate = POSSESSION.boxFoulChance * defender.tactics.fouls * r.factors.cardBoost
    if (rng.chance(boxRate)) {
      penalty(r, p, boxRate)
      return { outcome: 'shot', end: PENALTY_SPOT, corner: false }
    }
  }

  const kind = chooseEntryKind(r, p)
  const success = clamp(
    POSSESSION.entry *
      stageFactor(r, POSSESSION.entryPower, p) *
      (1 / defender.tactics.defence) *
      attacker.tactics.attackRate *
      (r.fastBreak ? POSSESSION.fastBreakStep : 1) *
      tempoFactor(r),
    0.02,
    0.95,
  )
  if (rng.chance(success)) {
    const spot = shotSpotFor(r, kind, p)
    const header = kind === 'cross' && rng.chance(0.75)
    const isPass = kind !== 'carry'
    const shooter = isPass ? shooterFor(r, spot, header) : r.carrier
    if (isPass) {
      creditStep(r, r.carrier, kind)
      pushPoint(r, spot, shooter, 'shot')
    } else {
      creditStep(r, r.carrier, 'carry')
      pushPoint(r, spot, shooter, 'shot')
    }
    const { mult, note } = situationFor(r, kind, header)
    const { corner } = takeShot(r, {
      spot,
      shooter,
      assist: isPass ? r.carrier : undefined,
      header,
      situation: mult,
      situationNote: note,
      source: r.fastBreak ? 'counter' : r.source,
    })
    return { outcome: 'shot', end: spot, corner }
  }

  // The entry failed. Sometimes the man on the ball just has a go from range.
  if (rng.chance(POSSESSION.longShotChance)) {
    // Long-range efforts come from the central channels, not the touchline.
    const spot = { x: clamp(p.x, 0.62, 0.76), y: clamp01(0.5 + (p.y - 0.5) * 0.55 + rng.gaussian() * 0.06) }
    pushPoint(r, spot, r.carrier, 'shot')
    const { corner } = takeShot(r, {
      spot,
      shooter: r.carrier,
      assist: r.lastPasser >= 0 ? r.lastPasser : undefined,
      header: false,
      situation: r.fastBreak ? POSSESSION.fastBreakXg : 1,
      situationNote: r.fastBreak ? 'fast break' : '',
      source: r.fastBreak ? 'counter' : r.source,
    })
    return { outcome: 'shot', end: spot, corner }
  }

  creditTurnover(r, p, kind === 'carry' ? 'carry' : 'pass')
  if (rng.chance(POSSESSION.cornerFromFailedEntry)) {
    pushPoint(r, p, r.carrier, 'corner')
    return { outcome: 'corner-won', end: p, corner: true }
  }
  pushPoint(r, p, r.carrier, 'turnover')
  return { outcome: 'turnover', end: p, corner: false }
}

/**
 * Run one possession from a starting point. The caller decides what the
 * outcome means for the next possession (a counter, a corner, a free kick).
 */
export function playPossession(
  ctx: EngineContext,
  attacker: SideState,
  defender: SideState,
  minute: number,
  start: PitchPoint,
  source: ChanceSource,
  fastBreak: boolean,
  factors: MinuteFactors,
): PossessionResult {
  const seqIndex = ctx.sequences.length
  const r: Runner = {
    ctx,
    attacker,
    defender,
    minute,
    factors,
    source,
    fastBreak,
    points: [],
    carrier: 0,
    lastPasser: -1,
    passes: 0,
    seqIndex,
  }
  const sequence: PossessionSequence = {
    minute,
    side: attacker.side,
    t0: 0,
    t1: 0,
    source,
    points: r.points,
    outcome: 'held',
  }
  ctx.sequences.push(sequence)
  const { rng } = ctx

  let p: PitchPoint = { x: clamp01(start.x), y: clamp01(start.y) }
  r.carrier = pickCarrier(r, p)
  pushPoint(r, p, r.carrier, 'restart')

  const maxSteps = fastBreak ? POSSESSION.fastBreakSteps : POSSESSION.maxSteps
  const finish = (
    outcome: SequenceOutcome,
    end: PitchPoint,
    counterable: boolean,
    corner = false,
    xg?: number,
  ): PossessionResult => {
    sequence.outcome = outcome
    if (xg !== undefined) sequence.xg = xg
    return { outcome, end, counterable, corner }
  }

  for (let step = 0; step < maxSteps; step++) {
    // Fouls around the ball before the contest resolves.
    if (defensiveFoul(r, p)) {
      pushPoint(r, p, r.carrier, 'foul')
      return finish('foul-won', p, false)
    }
    if (offensiveFoul(r, p)) {
      pushPoint(r, p, r.carrier, 'turnover')
      return finish('turnover', p, false)
    }

    const third = p.x >= 0.6 ? 'final' : thirdOf(p.x)
    if (third === 'final') {
      const { outcome, end, corner } = finalThird(r, p)
      const shot = ctx.events[ctx.events.length - 1]
      const xg = outcome === 'shot' && shot && typeof shot.xg === 'number' ? shot.xg : undefined
      // A corner keeps the ball; anything else hands it over (shots to the keeper, dead).
      return finish(outcome, end, outcome === 'turnover', corner, xg)
    }

    if (third === 'middle') {
      // An opponent committed forward (attacking mentality) leaves the middle open.
      const success = clamp(
        POSSESSION.progress *
          stageFactor(r, POSSESSION.progressPower, p) *
          Math.pow(attacker.strength.midfield / Math.max(defender.strength.midfield, 1), POSSESSION.midfieldPower) *
          (1 / defender.tactics.defence) *
          (fastBreak ? POSSESSION.fastBreakStep : 1) *
          tempoFactor(r),
        0.05,
        0.95,
      )
      const u = rng.next()
      const kind: BallAction = u < 0.6 ? 'pass' : u < 0.85 ? 'carry' : 'through-ball'
      if (rng.chance(success)) {
        const next = { x: 0.62 + rng.next() * 0.2, y: clamp01(p.y + rng.gaussian() * 0.18) }
        const receiver = kind === 'carry' ? r.carrier : pickCarrier(r, next)
        creditStep(r, r.carrier, receiver === r.carrier ? 'carry' : kind)
        r.points[r.points.length - 1].action = receiver === r.carrier ? 'carry' : kind
        r.carrier = receiver
        p = next
        pushPoint(r, p, r.carrier, 'end')
        continue
      }
      creditTurnover(r, p, kind)
      const lost = { x: clamp01(p.x + (rng.next() - 0.3) * 0.15), y: clamp01(p.y + rng.gaussian() * 0.12) }
      r.points[r.points.length - 1].action = 'turnover'
      pushPoint(r, lost, undefined, 'turnover')
      return finish('turnover', lost, true)
    }

    // Defensive third: build out against the press.
    const base = clamp(POSSESSION.buildOut * stageFactor(r, POSSESSION.buildOutPower, p), 0.2, 0.97)
    const success = clamp(1 - (1 - base) * defender.tactics.pressRegain, 0.1, 0.97)
    const u = rng.next()
    const kind: BallAction = u < 0.7 ? 'pass' : 'carry'
    if (rng.chance(success)) {
      const next = { x: 0.36 + rng.next() * 0.22, y: clamp01(p.y + rng.gaussian() * 0.22) }
      const receiver = kind === 'carry' ? r.carrier : pickCarrier(r, next)
      creditStep(r, r.carrier, receiver === r.carrier ? 'carry' : kind)
      r.points[r.points.length - 1].action = receiver === r.carrier ? 'carry' : kind
      r.carrier = receiver
      p = next
      pushPoint(r, p, r.carrier, 'end')
      continue
    }
    creditTurnover(r, p, kind)
    r.points[r.points.length - 1].action = 'turnover'
    const lost = { x: clamp01(p.x + rng.next() * 0.1), y: clamp01(p.y + rng.gaussian() * 0.1) }
    pushPoint(r, lost, undefined, 'turnover')
    return finish('turnover', lost, true)
  }

  // Ran out of steps: the move fizzles, the ball stays live with the attackers.
  return finish('held', p, false)
}

/** A corner: delivery into the box, a header if the attackers win it. */
export function playCorner(
  ctx: EngineContext,
  attacker: SideState,
  defender: SideState,
  minute: number,
  fromY: number,
  factors: MinuteFactors,
): PossessionResult {
  const seqIndex = ctx.sequences.length
  const r: Runner = {
    ctx,
    attacker,
    defender,
    minute,
    factors,
    source: 'corner',
    fastBreak: false,
    points: [],
    carrier: attacker.profile.freeKickTaker,
    lastPasser: -1,
    passes: 0,
    seqIndex,
  }
  const sequence: PossessionSequence = { minute, side: attacker.side, t0: 0, t1: 0, source: 'corner', points: r.points, outcome: 'held' }
  ctx.sequences.push(sequence)
  attacker.stats.corners += 1
  const flag = cornerSpot(fromY)
  pushPoint(r, flag, r.carrier, 'corner')
  ctx.events.push({
    minute,
    type: 'corner',
    side: attacker.side,
    teamId: attacker.sheet.teamId,
    player: attacker.profile.players[r.carrier]?.player,
    spot: flag,
    sequence: seqIndex,
    score: score(ctx),
    commentary: ctx.commentary.lineAt('corner', minute, { team: attacker.sheet.name, player: attacker.profile.players[r.carrier]?.player.name }),
  })

  const { rng } = ctx
  const landing = { x: 0.9 + rng.next() * 0.07, y: clamp01(0.5 + rng.gaussian() * 0.1) }
  const z = zoneIndex(landing)
  const aerial = Math.pow(attacker.profile.progress[z] / Math.max(defender.profile.defence[z], 1), 0.5)
  const chance = clamp(POSSESSION.cornerShotChance * aerial * Math.sqrt(factors.shotBoost), 0.05, 0.8)
  if (rng.chance(chance)) {
    const shooter = shooterFor(r, landing, true)
    creditStep(r, r.carrier, 'cross')
    pushPoint(r, landing, shooter, 'shot')
    const { corner } = takeShot(r, {
      spot: landing,
      shooter,
      assist: r.carrier,
      header: true,
      situation: POSSESSION.cornerHeaderXg,
      situationNote: 'header from a corner',
      source: 'corner',
    })
    sequence.outcome = 'shot'
    const shot = ctx.events[ctx.events.length - 1]
    if (shot && typeof shot.xg === 'number') sequence.xg = shot.xg
    return { outcome: 'shot', end: landing, counterable: false, corner }
  }
  // Cleared.
  creditTurnover(r, landing, 'cross')
  pushPoint(r, landing, undefined, 'turnover')
  sequence.outcome = 'turnover'
  if (rng.chance(POSSESSION.cornerFromClearance)) {
    sequence.outcome = 'corner-won'
    return { outcome: 'corner-won', end: landing, counterable: false, corner: true }
  }
  return { outcome: 'turnover', end: { x: 0.75, y: landing.y }, counterable: true, corner: false }
}

/** A direct free kick from a spot in range. */
export function playFreeKick(
  ctx: EngineContext,
  attacker: SideState,
  defender: SideState,
  minute: number,
  spot: PitchPoint,
  factors: MinuteFactors,
): PossessionResult {
  const seqIndex = ctx.sequences.length
  const taker = attacker.profile.freeKickTaker
  const r: Runner = {
    ctx,
    attacker,
    defender,
    minute,
    factors,
    source: 'free-kick',
    fastBreak: false,
    points: [],
    carrier: taker,
    lastPasser: -1,
    passes: 0,
    seqIndex,
  }
  const sequence: PossessionSequence = { minute, side: attacker.side, t0: 0, t1: 0, source: 'free-kick', points: r.points, outcome: 'shot' }
  ctx.sequences.push(sequence)
  pushPoint(r, spot, taker, 'free-kick')
  pushPoint(r, spot, taker, 'shot')
  const { corner } = takeShot(r, {
    spot,
    shooter: taker,
    header: false,
    situation: POSSESSION.freeKickXg,
    situationNote: 'over the wall',
    source: 'free-kick',
  })
  const shot = ctx.events[ctx.events.length - 1]
  if (shot && typeof shot.xg === 'number') sequence.xg = shot.xg
  return { outcome: 'shot', end: spot, counterable: false, corner }
}

export function inFreeKickRange(p: PitchPoint): boolean {
  return p.x >= POSSESSION.freeKickRangeX && Math.abs(p.y - 0.5) <= POSSESSION.freeKickRangeY
}
