import { createCommentator, type CommentaryTag, type Commentator } from './commentary'
import { EMPIRICAL_ON_TARGET_GIVEN_MISS, EMPIRICAL_XG_PER_SHOT, goalMinuteFactor } from './empirical'
import { computeAnchoredStrength, positionPenalty } from './ratings'
import { createRng, type Rng } from './rng'
import { shootoutTakers, simulateShootout } from './shootout'
import type {
  Line,
  MatchEvent,
  Player,
  Score,
  Side,
  SideStats,
  SimOptions,
  SimResult,
  SlotAssignment,
  TeamSheet,
  TeamStrength,
  MomentumTimelinePoint,
  XgTimelinePoint,
} from './types'

/**
 * Engine tuning. Calibrated so that with the real lineups England are clear
 * favourites (they won the real match) while Mexico's shot volume still wins
 * them a meaningful share of replays — see monteCarlo.test.ts.
 */
const TUNING = {
  /** How strongly a midfield edge converts into possession share. */
  possessionExponent: 2,
  /** Weight of the fixture's real possession share when one is supplied. */
  realPossessionWeight: 0.5,
  /** Per-minute shot probability at 100% possession and even ratings. */
  baseShotRate: 0.3,
  /** Exponent on attack/defence ratio for shot frequency. */
  attackDefencePower: 1.8,
  /** Shot quality (xG) distribution: base + spread * u^skew, skewed to low-quality chances. */
  xgBase: 0.02,
  xgSpread: 0.4,
  xgSkew: 3,
  /** Mean of the raw xg draw above (base + spread/(skew+1)); used to rescale to the empirical mean. */
  xgRawMean: 0.12,
  /** Chance a non-goal shot still tests the keeper (StatsBomb-derived, see empirical.ts). */
  onTargetChance: EMPIRICAL_ON_TARGET_GIVEN_MISS,
  /** Per-minute card probabilities per side. */
  yellowRate: 0.018,
  redRate: 0.0009,
  /** Momentum: scoring team rides the wave for a few minutes; random swings too. */
  goalBoost: 1.12,
  goalBoostMinutes: 6,
  swingChance: 0.02,
  swingBoost: 1.18,
  swingMinutes: 7,
  /** Strength multipliers after a red card (on top of losing the player). */
  shortHandedAttack: 0.7,
  shortHandedMidfield: 0.75,
  shortHandedDefence: 0.85,
  subWindowMinutes: [60, 75],
  matchMinutes: 90,
  extraTimeMinutes: 120,
  /** Fatigue in extra time: defences leak more and legs give away more fouls. */
  extraTimeShotBoost: 1.3,
  extraTimeCardBoost: 1.6,
} as const

const SHOT_LINE_WEIGHT: Record<Line, number> = { GK: 0, DEF: 0.7, MID: 2.5, FWD: 5 }
const FOUL_LINE_WEIGHT: Record<Line, number> = { GK: 0.2, DEF: 1.2, MID: 1, FWD: 0.6 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface SideState {
  side: Side
  sheet: TeamSheet
  onPitch: SlotAssignment[]
  strength: TeamStrength
  goals: number
  /** Largest deficit this side has faced — fuels "comeback" commentary. */
  maxDeficit: number
  /** Clearly weaker per the results-fitted baselines. */
  underdog: boolean
  boost: number
  boostUntil: number
  yellowsByPlayer: Map<string, number>
  stats: SideStats
}

const UNDERDOG_GAP = 30 // engine-scale baseline points (attack + defence)

function initSide(side: Side, sheet: TeamSheet): SideState {
  return {
    side,
    sheet,
    onPitch: [...sheet.starters],
    strength: computeAnchoredStrength(sheet),
    goals: 0,
    maxDeficit: 0,
    underdog: false,
    boost: 1,
    boostUntil: 0,
    yellowsByPlayer: new Map(),
    stats: { shots: 0, onTarget: 0, goals: 0, xg: 0, possession: 0, yellows: 0, reds: 0 },
  }
}

function markUnderdog(home: SideState, away: SideState): void {
  const sum = (s: SideState) => (s.sheet.anchor ? s.sheet.anchor.attack + s.sheet.anchor.defence : null)
  const h = sum(home)
  const a = sum(away)
  if (h === null || a === null) return
  if (h + UNDERDOG_GAP <= a) home.underdog = true
  if (a + UNDERDOG_GAP <= h) away.underdog = true
}

function playerTags(player: Player, slotLine: Line): CommentaryTag[] {
  const tags: CommentaryTag[] = []
  const r = player.ratings
  if (Math.max(r.pace, r.shooting, r.passing, r.defending, r.physical) >= 88) tags.push('star')
  if (r.position !== slotLine) tags.push('outOfPosition')
  return tags
}

function boostAt(state: SideState, minute: number): number {
  return minute <= state.boostUntil ? state.boost : 1
}

function applyRedCard(state: SideState, player: Player): void {
  state.onPitch = state.onPitch.filter((a) => a.player.id !== player.id)
  const reduced = computeAnchoredStrength(state.sheet, state.onPitch)
  state.strength = {
    ...reduced,
    attack: reduced.attack * TUNING.shortHandedAttack,
    midfield: reduced.midfield * TUNING.shortHandedMidfield,
    defence: reduced.defence * TUNING.shortHandedDefence,
  }
  state.stats.reds += 1
}

function pickShooter(rng: Rng, state: SideState): SlotAssignment {
  return rng.weightedPick(state.onPitch, ({ slot, player }) => {
    const positionFactor = SHOT_LINE_WEIGHT[slot.line]
    return positionFactor * Math.max(player.ratings.shooting, 1)
  })
}

function pickFouler(rng: Rng, state: SideState): SlotAssignment {
  return rng.weightedPick(state.onPitch, ({ slot, player }) => {
    const aggression = player.ratings.defending * 0.6 + player.ratings.physical * 0.4
    return FOUL_LINE_WEIGHT[slot.line] * Math.max(aggression, 1)
  })
}

interface EngineContext {
  rng: Rng
  events: MatchEvent[]
  home: SideState
  away: SideState
  commentary: Commentator & { lineAt: (type: Parameters<Commentator['line']>[0], minute: number, ctx?: Parameters<Commentator['line']>[1]) => string }
}

function score(ctx: EngineContext): Score {
  return { home: ctx.home.goals, away: ctx.away.goals }
}

function attemptShot(
  ctx: EngineContext,
  attacker: SideState,
  defender: SideState,
  minute: number,
  possession: number,
  segment: SegmentTuning,
): void {
  const { rng, events } = ctx
  const { slot, player } = pickShooter(rng, attacker)

  // Shot quality: mostly scrappy half-chances, occasionally a golden one —
  // rescaled so the mean chance matches real knockout football's xG/shot —
  // then scaled by the shooter's effective shooting in their slot and the
  // attacking shape's chance-quality modifier.
  const raw =
    (TUNING.xgBase + TUNING.xgSpread * Math.pow(rng.next(), TUNING.xgSkew)) *
    (EMPIRICAL_XG_PER_SHOT / TUNING.xgRawMean)
  const penalty = positionPenalty(player.ratings.position, slot.line)
  const shapeQuality = attacker.sheet.modifiers?.chanceQuality ?? 1
  const quality = clamp((player.ratings.shooting * penalty) / 80, 0.6, 1.3) * shapeQuality
  const xg = Math.min(raw * quality, 0.85)

  attacker.stats.shots += 1
  attacker.stats.xg += xg

  const shapeNote = (value: number | undefined, sheet: TeamSheet): string =>
    value !== undefined && value !== 1 && sheet.formation ? ` (×${value.toFixed(2)} ${sheet.formation} shape)` : ''

  const chanceContext =
    `Chance for ${attacker.sheet.name}: attack ${Math.round(attacker.strength.attack)}` +
    shapeNote(attacker.sheet.modifiers?.attack, attacker.sheet) +
    ` vs defence ${Math.round(defender.strength.defence)}` +
    shapeNote(defender.sheet.modifiers?.defence, defender.sheet) +
    `, possession weight ${Math.round(possession * 100)}%` +
    (segment.shotBoost > 1 ? `, extra-time fatigue ×${segment.shotBoost}` : '') +
    `. Shot quality xG ${xg.toFixed(2)} — ${player.name}, shooting ${player.ratings.shooting}` +
    (penalty < 1 ? ` reduced ×${penalty.toFixed(2)} for playing ${slot.label} out of position` : '') +
    (shapeQuality !== 1 && attacker.sheet.formation
      ? `, quality ×${shapeQuality.toFixed(2)} from the ${attacker.sheet.formation} shape`
      : '') +
    '.'

  // Conversion: the chance's xG, nudged by the opposing keeper's quality.
  const gkFactor = clamp(1 - (defender.strength.goalkeeping - 75) / 150, 0.7, 1.15)
  const conversionContext =
    ` Conversion odds ${Math.round(xg * gkFactor * 100)}% against keeper quality ` +
    `${Math.round(defender.strength.goalkeeping)} (factor ×${gkFactor.toFixed(2)})`
  const baseTags = playerTags(player, slot.line)
  if (rng.chance(xg * gkFactor)) {
    const diffBefore = attacker.goals - defender.goals
    attacker.goals += 1
    attacker.stats.goals += 1
    attacker.stats.onTarget += 1
    attacker.boost = TUNING.goalBoost
    attacker.boostUntil = minute + TUNING.goalBoostMinutes
    defender.maxDeficit = Math.max(defender.maxDeficit, attacker.goals - defender.goals)
    const diffAfter = attacker.goals - defender.goals
    const tags: CommentaryTag[] = [...baseTags]
    if (diffAfter === 0) tags.push('equalizer')
    if (diffAfter > 0 && diffBefore <= 0) tags.push('goAhead')
    if (diffAfter < 0) tags.push('consolation')
    if ((diffAfter === 0 || (diffAfter > 0 && diffBefore <= 0)) && attacker.maxDeficit >= 2) tags.push('comeback')
    if (minute >= 85) tags.push('lateDrama')
    if (attacker.underdog) tags.push('underdog')
    events.push({
      minute,
      type: 'goal',
      side: attacker.side,
      teamId: attacker.sheet.teamId,
      player,
      xg,
      score: score(ctx),
      commentary: ctx.commentary.lineAt('goal', minute, {
        player: player.name,
        team: attacker.sheet.name,
        xg,
        score: `${attacker.goals}–${defender.goals}`,
        tags,
      }),
      reasoning: `${chanceContext}${conversionContext} — roll passed: GOAL.`,
    })
    return
  }

  const onTarget = rng.chance(TUNING.onTargetChance)
  if (onTarget) attacker.stats.onTarget += 1
  const type = onTarget ? 'shot-saved' : 'shot-miss'
  events.push({
    minute,
    type,
    side: attacker.side,
    teamId: attacker.sheet.teamId,
    player,
    xg,
    score: score(ctx),
    commentary: ctx.commentary.lineAt(type, minute, {
      player: player.name,
      opponent: defender.sheet.name,
      xg,
      tags: baseTags,
    }),
    reasoning: `${chanceContext}${conversionContext} — roll failed: ${onTarget ? 'saved' : 'off target'}.`,
  })
}

function foulerProfile(player: Player, cardBoost: number): string {
  return (
    `${player.name} is a likely fouler (defending ${player.ratings.defending}, physical ${player.ratings.physical})` +
    (cardBoost > 1 ? `; extra-time fatigue raises card risk ×${cardBoost}` : '') +
    '.'
  )
}

function attemptCards(ctx: EngineContext, side: SideState, minute: number, cardBoost: number): void {
  const { rng, events } = ctx
  if (side.onPitch.length === 0) return

  if (rng.chance(TUNING.redRate * cardBoost)) {
    const { player } = pickFouler(rng, side)
    applyRedCard(side, player)
    events.push({
      minute,
      type: 'red-card',
      side: side.side,
      teamId: side.sheet.teamId,
      player,
      score: score(ctx),
      commentary: ctx.commentary.lineAt('red-card', minute, { player: player.name, team: side.sheet.name }),
      reasoning:
        `Straight red (base rate ${(TUNING.redRate * cardBoost * 100).toFixed(2)}%/min per side). ${foulerProfile(player, cardBoost)} ` +
        `${side.sheet.name} drop to ${side.onPitch.length} players; attack ×${TUNING.shortHandedAttack}, midfield ×${TUNING.shortHandedMidfield}, defence ×${TUNING.shortHandedDefence}.`,
    })
    return
  }

  if (rng.chance(TUNING.yellowRate * cardBoost)) {
    const { player } = pickFouler(rng, side)
    const priorYellows = side.yellowsByPlayer.get(player.id) ?? 0
    if (priorYellows >= 1) {
      // Second yellow: off he goes.
      applyRedCard(side, player)
      events.push({
        minute,
        type: 'red-card',
        side: side.side,
        teamId: side.sheet.teamId,
        player,
        score: score(ctx),
        commentary: ctx.commentary.lineAt('red-card', minute, { player: player.name, team: side.sheet.name }),
        reasoning:
          `Second yellow for ${player.name} → red. ${foulerProfile(player, cardBoost)} ` +
          `${side.sheet.name} drop to ${side.onPitch.length} players; attack ×${TUNING.shortHandedAttack}, midfield ×${TUNING.shortHandedMidfield}, defence ×${TUNING.shortHandedDefence}.`,
      })
      return
    }
    side.yellowsByPlayer.set(player.id, priorYellows + 1)
    side.stats.yellows += 1
    events.push({
      minute,
      type: 'yellow-card',
      side: side.side,
      teamId: side.sheet.teamId,
      player,
      score: score(ctx),
      commentary: ctx.commentary.lineAt('yellow-card', minute, { player: player.name }),
      reasoning: `Booking (base rate ${(TUNING.yellowRate * cardBoost * 100).toFixed(1)}%/min per side). ${foulerProfile(player, cardBoost)} A second yellow would mean red.`,
    })
  }
}

interface SegmentTuning {
  shotBoost: number
  cardBoost: number
}

/** The minute the first half ends — where a half-time pause can happen. */
export const HALFTIME_MINUTE = 45

/**
 * A match frozen at the half-time whistle: the live rng, the commentator
 * riding it and both sides' mutable state, mid-stream. Internal engine handle,
 * not part of the public SimResult shape — it holds closures and shared
 * mutable arrays on purpose so the second half continues the exact same
 * random stream and pushes onto the same timelines. Not serializable; a
 * reload loses the paused match.
 */
export interface HalftimeState extends EngineContext {
  xgTimeline: XgTimelinePoint[]
  momentumTimeline: MomentumTimelinePoint[]
  possessionHomeSum: number
  minutesPlayed: number
  options: SimOptions
  seed: number
}

function playMinutes(state: HalftimeState, from: number, to: number, segment: SegmentTuning): void {
  const { rng, events, home, away, options } = state
  for (let minute = from; minute <= to; minute += 1) {
    // Possession tug-of-war from midfield strength (momentum tilts it a little),
    // blended toward the fixture's real possession split when one is supplied.
    const homeMid = home.strength.midfield * boostAt(home, minute)
    const awayMid = away.strength.midfield * boostAt(away, minute)
    const k = TUNING.possessionExponent
    let possHome = Math.pow(homeMid, k) / (Math.pow(homeMid, k) + Math.pow(awayMid, k))
    if (options.homePossession !== undefined) {
      const w = TUNING.realPossessionWeight
      possHome = clamp((1 - w) * possHome + w * options.homePossession, 0.05, 0.95)
    }
    state.possessionHomeSum += possHome
    state.minutesPlayed += 1
    // Home-tilt of this minute's possession, for the momentum view. possHome
    // already carries the goal/swing boosts, so this traces real momentum.
    state.momentumTimeline.push({ minute, value: Math.round((possHome - 0.5) * 200) })

    // Random momentum swings when nothing else is boosting.
    if (minute > home.boostUntil && minute > away.boostUntil && rng.chance(TUNING.swingChance)) {
      const swung = rng.weightedPick([home, away], (s) => s.strength.midfield)
      swung.boost = TUNING.swingBoost
      swung.boostUntil = minute + TUNING.swingMinutes
      events.push({
        minute,
        type: 'momentum',
        side: swung.side,
        teamId: swung.sheet.teamId,
        score: score(state),
        commentary: state.commentary.lineAt('momentum', minute, { team: swung.sheet.name }),
        reasoning:
          `Random momentum swing (${TUNING.swingChance * 100}%/min when nothing else is boosting), weighted by midfield: ` +
          `${home.sheet.name} ${Math.round(home.strength.midfield)} vs ${away.sheet.name} ${Math.round(away.strength.midfield)}. ` +
          `${swung.sheet.name} ride it — chance rates ×${TUNING.swingBoost} for ${TUNING.swingMinutes} minutes.`,
      })
    }

    if ((TUNING.subWindowMinutes as readonly number[]).includes(minute)) {
      events.push({
        minute,
        type: 'sub-window',
        score: score(state),
        commentary: state.commentary.lineAt('sub-window', minute),
      })
    }

    // Real goals cluster late in each half — scale the chance rate by the
    // empirical minute-of-goal factor (mean 1, so volumes are unchanged).
    const timeFactor = goalMinuteFactor(minute)

    for (const [attacker, defender, possession] of [
      [home, away, possHome],
      [away, home, 1 - possHome],
    ] as const) {
      const ratio = attacker.strength.attack / Math.max(defender.strength.defence, 1)
      const shotChance =
        TUNING.baseShotRate *
        segment.shotBoost *
        timeFactor *
        possession *
        Math.pow(ratio, TUNING.attackDefencePower) *
        boostAt(attacker, minute)
      if (rng.chance(clamp(shotChance, 0, 0.6))) {
        attemptShot(state, attacker, defender, minute, possession, segment)
      }
    }

    attemptCards(state, home, minute, segment.cardBoost)
    attemptCards(state, away, minute, segment.cardBoost)

    state.xgTimeline.push({
      minute,
      home: round2(home.stats.xg),
      away: round2(away.stats.xg),
    })
  }
}

/**
 * Play minutes 1–45 and freeze the match at the whistle. The returned handle
 * feeds resumeMatch — with the same sheets for an uninterrupted match, or
 * with changed sheets for half-time substitutions and formation switches.
 */
export function playFirstHalf(
  homeSheet: TeamSheet,
  awaySheet: TeamSheet,
  seed: number,
  options: SimOptions = {},
): HalftimeState {
  const rng = createRng(seed)
  const commentary = createCommentator(rng)
  const home = initSide('home', homeSheet)
  const away = initSide('away', awaySheet)
  markUnderdog(home, away)
  const state: HalftimeState = {
    rng,
    commentary,
    home,
    away,
    events: [],
    xgTimeline: [],
    momentumTimeline: [],
    possessionHomeSum: 0,
    minutesPlayed: 0,
    options,
    seed,
  }

  state.events.push({
    minute: 0,
    type: 'kickoff',
    score: { home: 0, away: 0 },
    commentary: commentary.line('kickoff', { team: homeSheet.name }),
  })

  playMinutes(state, 1, HALFTIME_MINUTE, { shotBoost: 1, cardBoost: 1 })
  return state
}

/** Ids of players sent off so far — unavailable for the rest of the match. */
export function sentOffIds(state: HalftimeState): Set<string> {
  return new Set(
    state.events.filter((e) => e.type === 'red-card' && e.player).map((e) => e.player!.id),
  )
}

/**
 * Point a side at its second-half sheet. The new starters take the pitch
 * (minus anyone already sent off — a dismissal is permanent) and strength
 * re-anchors to the new lineup via the same computation initSide and
 * applyRedCard use, so an unchanged sheet reproduces the first half's
 * numbers exactly.
 */
function applySecondHalfSheet(side: SideState, sheet: TeamSheet, sentOff: ReadonlySet<string>): void {
  side.sheet = sheet
  side.onPitch = sheet.starters.filter((a) => !sentOff.has(a.player.id))
  const strength = computeAnchoredStrength(sheet, side.onPitch)
  side.strength =
    side.stats.reds > 0
      ? {
          ...strength,
          attack: strength.attack * TUNING.shortHandedAttack,
          midfield: strength.midfield * TUNING.shortHandedMidfield,
          defence: strength.defence * TUNING.shortHandedDefence,
        }
      : strength
}

/**
 * Play out the rest of a match frozen at half-time with (possibly changed)
 * sheets. Continues the same rng and pushes onto the same event/timeline
 * arrays — the first half is never re-rolled or rewritten. Consumes the
 * state; resuming the same handle twice is a bug.
 */
export function resumeMatch(state: HalftimeState, newHomeSheet: TeamSheet, newAwaySheet: TeamSheet): SimResult {
  if (state.minutesPlayed !== HALFTIME_MINUTE) {
    throw new Error(
      `resumeMatch expects a state frozen at ${HALFTIME_MINUTE}', got ${state.minutesPlayed} minutes played`,
    )
  }
  const sentOff = sentOffIds(state)
  applySecondHalfSheet(state.home, newHomeSheet, sentOff)
  applySecondHalfSheet(state.away, newAwaySheet, sentOff)
  playMinutes(state, HALFTIME_MINUTE + 1, TUNING.matchMinutes, { shotBoost: 1, cardBoost: 1 })
  return finishMatch(state)
}

/** The post-90' tail every path shares: extra time, shootout, full-time, stats. */
function finishMatch(state: HalftimeState): SimResult {
  const { rng, commentary, events, home, away, options, xgTimeline, momentumTimeline, seed } = state
  const regulationScore = score(state)

  const wentToExtraTime = Boolean(options.knockout) && home.goals === away.goals
  if (wentToExtraTime) {
    events.push({
      minute: TUNING.matchMinutes,
      type: 'extra-time',
      score: score(state),
      commentary: commentary.line('extra-time'),
      reasoning:
        `Level at 90' in a knockout tie, so 30 more minutes are played. Fatigue: chance creation ×${TUNING.extraTimeShotBoost}, ` +
        `card risk ×${TUNING.extraTimeCardBoost} for minutes 91–120.`,
    })
    playMinutes(state, TUNING.matchMinutes + 1, TUNING.extraTimeMinutes, {
      shotBoost: TUNING.extraTimeShotBoost,
      cardBoost: TUNING.extraTimeCardBoost,
    })
  }

  const endMinute = wentToExtraTime ? TUNING.extraTimeMinutes : TUNING.matchMinutes

  let shootout: SimResult['shootout']
  if (options.knockout && home.goals === away.goals) {
    events.push({
      minute: endMinute,
      type: 'penalties',
      score: score(state),
      commentary: commentary.line('penalties'),
      reasoning:
        `Still level after 120', so a shootout decides it: five kicks each, then sudden death. ` +
        `Each kick converts at 74% baseline, adjusted up for the taker's shooting and down for the opposing keeper's quality.`,
    })
    shootout = simulateShootout(
      rng,
      { takers: shootoutTakers(home.onPitch), goalkeeping: home.strength.goalkeeping },
      { takers: shootoutTakers(away.onPitch), goalkeeping: away.strength.goalkeeping },
      commentary,
    )
  }

  events.push({
    minute: endMinute,
    type: 'full-time',
    score: score(state),
    commentary: commentary.line('full-time'),
  })

  home.stats.possession = Math.round((state.possessionHomeSum / state.minutesPlayed) * 100)
  away.stats.possession = 100 - home.stats.possession
  home.stats.xg = round2(home.stats.xg)
  away.stats.xg = round2(away.stats.xg)

  const finalScore = score(state)
  let winner: Side | undefined
  if (options.knockout) {
    if (finalScore.home !== finalScore.away) {
      winner = finalScore.home > finalScore.away ? 'home' : 'away'
    } else {
      winner = shootout?.winner
    }
  }

  return {
    seed,
    finalScore,
    regulationScore,
    wentToExtraTime,
    shootout,
    winner,
    events,
    xgTimeline,
    momentumTimeline,
    stats: { home: home.stats, away: away.stats },
  }
}

/**
 * Simulate one match, minute by minute. Deterministic for a given seed.
 * In knockout mode a level match runs extra time (with fatigue) and, if still
 * level, a penalty shootout.
 *
 * Composed as first half + resume with the same sheets, so a half-time pause
 * where nothing changes is byte-identical to an uninterrupted match — the
 * equivalence test in simulate.test.ts holds this line.
 */
export function simulateMatch(
  homeSheet: TeamSheet,
  awaySheet: TeamSheet,
  seed: number,
  options: SimOptions = {},
): SimResult {
  return resumeMatch(playFirstHalf(homeSheet, awaySheet, seed, options), homeSheet, awaySheet)
}

function cloneSide(side: SideState): SideState {
  return {
    ...side,
    onPitch: [...side.onPitch],
    yellowsByPlayer: new Map(side.yellowsByPlayer),
    stats: { ...side.stats },
  }
}

/**
 * Snapshot a half-time state for what-if replays: the mutable containers are
 * copied so a replay can't corrupt the live match, and the rng (with a fresh
 * commentator riding it) restarts from the given seed — Monte Carlo replays
 * sample many possible second halves rather than re-telling the live one.
 */
export function cloneHalftimeState(state: HalftimeState, seed: number): HalftimeState {
  const rng = createRng(seed)
  return {
    rng,
    commentary: createCommentator(rng),
    home: cloneSide(state.home),
    away: cloneSide(state.away),
    events: [...state.events],
    xgTimeline: [...state.xgTimeline],
    momentumTimeline: [...state.momentumTimeline],
    possessionHomeSum: state.possessionHomeSum,
    minutesPlayed: state.minutesPlayed,
    options: state.options,
    seed,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
