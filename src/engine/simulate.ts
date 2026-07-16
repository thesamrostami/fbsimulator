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

interface SideState {
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

/**
 * Simulate one match, minute by minute. Deterministic for a given seed.
 * In knockout mode a level match runs extra time (with fatigue) and, if still
 * level, a penalty shootout.
 */
export function simulateMatch(
  homeSheet: TeamSheet,
  awaySheet: TeamSheet,
  seed: number,
  options: SimOptions = {},
): SimResult {
  const rng = createRng(seed)
  const commentary = createCommentator(rng)
  const home = initSide('home', homeSheet)
  const away = initSide('away', awaySheet)
  markUnderdog(home, away)
  const events: MatchEvent[] = []
  const ctx: EngineContext = { rng, events, home, away, commentary }
  const xgTimeline: XgTimelinePoint[] = []

  events.push({
    minute: 0,
    type: 'kickoff',
    score: { home: 0, away: 0 },
    commentary: commentary.line('kickoff', { team: homeSheet.name }),
  })

  let possessionHomeSum = 0
  let minutesPlayed = 0

  const playMinutes = (from: number, to: number, segment: SegmentTuning) => {
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
      possessionHomeSum += possHome
      minutesPlayed += 1

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
          score: score(ctx),
          commentary: ctx.commentary.lineAt('momentum', minute, { team: swung.sheet.name }),
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
          score: score(ctx),
          commentary: ctx.commentary.lineAt('sub-window', minute),
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
          attemptShot(ctx, attacker, defender, minute, possession, segment)
        }
      }

      attemptCards(ctx, home, minute, segment.cardBoost)
      attemptCards(ctx, away, minute, segment.cardBoost)

      xgTimeline.push({
        minute,
        home: round2(home.stats.xg),
        away: round2(away.stats.xg),
      })
    }
  }

  playMinutes(1, TUNING.matchMinutes, { shotBoost: 1, cardBoost: 1 })
  const regulationScore = score(ctx)

  const wentToExtraTime = Boolean(options.knockout) && home.goals === away.goals
  if (wentToExtraTime) {
    events.push({
      minute: TUNING.matchMinutes,
      type: 'extra-time',
      score: score(ctx),
      commentary: commentary.line('extra-time'),
      reasoning:
        `Level at 90' in a knockout tie, so 30 more minutes are played. Fatigue: chance creation ×${TUNING.extraTimeShotBoost}, ` +
        `card risk ×${TUNING.extraTimeCardBoost} for minutes 91–120.`,
    })
    playMinutes(TUNING.matchMinutes + 1, TUNING.extraTimeMinutes, {
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
      score: score(ctx),
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
    score: score(ctx),
    commentary: commentary.line('full-time'),
  })

  home.stats.possession = Math.round((possessionHomeSum / minutesPlayed) * 100)
  away.stats.possession = 100 - home.stats.possession
  home.stats.xg = round2(home.stats.xg)
  away.stats.xg = round2(away.stats.xg)

  const finalScore = score(ctx)
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
    stats: { home: home.stats, away: away.stats },
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
