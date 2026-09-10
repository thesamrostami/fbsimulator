import { createCommentator } from './commentary'
import { mirror } from './pitch'
import {
  inFreeKickRange,
  playCorner,
  playFreeKick,
  playPossession,
  POSSESSION,
  type MinuteFactors,
  type PossessionResult,
} from './possession'
import { computeAnchoredStrength } from './ratings'
import { createRng } from './rng'
import { shootoutTakers, simulateShootout } from './shootout'
import {
  buildZoneProfile,
  emptySideStats,
  rosterOf,
  sideTactics,
  type BallState,
  type HalftimeState,
  type SideState,
} from './state'
import type {
  ChanceSource,
  PitchPoint,
  Player,
  PlayerMatchStats,
  Score,
  Side,
  SimOptions,
  SimResult,
  TeamSheet,
} from './types'

export type { HalftimeState, SideState } from './state'

/**
 * Match-level tuning. The possession mechanics (who wins each contest, where
 * shots come from, fouls and cards) live in possession.ts; this file owns
 * the clock: possession share, momentum, extra time and the shootout.
 *
 * Calibrated so that with the real lineups the real winner wins a plausible
 * share of Monte Carlo replays in every fixture — see calibration.test.ts.
 */
const TUNING = {
  /** How strongly a midfield edge converts into possession share. */
  possessionExponent: 2,
  /** Weight of the fixture's real possession share when one is supplied. */
  realPossessionWeight: 0.5,
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
  /** Possessions a single minute can hold: an attack, the break it concedes, a set piece. */
  maxPossessionsPerMinute: 3,
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const UNDERDOG_GAP = 30 // engine-scale baseline points (attack + defence)

function shortHanded(strength: SideState['strength']): SideState['strength'] {
  return {
    ...strength,
    attack: strength.attack * TUNING.shortHandedAttack,
    midfield: strength.midfield * TUNING.shortHandedMidfield,
    defence: strength.defence * TUNING.shortHandedDefence,
  }
}

function initSide(side: Side, sheet: TeamSheet): SideState {
  return {
    side,
    sheet,
    onPitch: [...sheet.starters],
    strength: computeAnchoredStrength(sheet),
    profile: buildZoneProfile(sheet.starters),
    tactics: sideTactics(sheet),
    goals: 0,
    maxDeficit: 0,
    underdog: false,
    boost: 1,
    boostUntil: 0,
    yellowsByPlayer: new Map(),
    stats: emptySideStats(),
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

function boostAt(state: SideState, minute: number): number {
  return minute <= state.boostUntil ? state.boost : 1
}

/** Red card: the player leaves, the side is re-rated and re-profiled. */
function sendOff(side: SideState, player: Player): void {
  side.onPitch = side.onPitch.filter((a) => a.player.id !== player.id)
  side.strength = shortHanded(computeAnchoredStrength(side.sheet, side.onPitch))
  side.profile = buildZoneProfile(side.onPitch)
  side.stats.reds += 1
}

function onGoal(scorer: SideState, conceder: SideState, minute: number): void {
  scorer.boost = TUNING.goalBoost
  scorer.boostUntil = minute + TUNING.goalBoostMinutes
  conceder.maxDeficit = Math.max(conceder.maxDeficit, scorer.goals - conceder.goals)
}

function score(state: HalftimeState): Score {
  return { home: state.home.goals, away: state.away.goals }
}

interface SegmentTuning {
  shotBoost: number
  cardBoost: number
}

/** The minute the first half ends — where a half-time pause can happen. */
export const HALFTIME_MINUTE = 45

/**
 * Every minute a match can be frozen at for changes: the break, then the
 * two substitution windows. Extra time has no windows (the engine plays
 * 91–120 straight through).
 */
export const PAUSE_MINUTES: readonly number[] = [HALFTIME_MINUTE, ...TUNING.subWindowMinutes]

export function isPauseMinute(minute: number): boolean {
  return PAUSE_MINUTES.includes(minute)
}

/** What the next possession of a minute is. */
interface NextPossession {
  side: SideState
  point: PitchPoint
  source: ChanceSource
  fastBreak: boolean
  corner?: boolean
  freeKick?: boolean
}

/** Where a side picks the ball up from a dead-ball restart (its own frame). */
function restartSpot(state: HalftimeState, side: SideState): PitchPoint {
  const { rng, ball } = state
  const y = clamp(0.5 + rng.gaussian() * 0.2, 0.05, 0.95)
  // The side with the goal kick builds from deep; the other side contests it in midfield.
  const x = ball.side === side.side ? 0.1 + rng.next() * 0.2 : 0.35 + rng.next() * 0.2
  return { x: x + side.tactics.lineShift, y }
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

    // Whose minute is it: the side that has the ball builds an attack; the
    // other side can only break when it wins the ball live.
    const attacker = rng.chance(possHome) ? home : away
    const other = (side: SideState) => (side === home ? away : home)
    const factorsFor = (side: SideState): MinuteFactors => ({
      shotBoost: segment.shotBoost,
      cardBoost: segment.cardBoost,
      momentum: boostAt(side, minute),
      possession: possHome,
    })

    const { ball } = state
    let start: PitchPoint
    if (ball.dead) start = restartSpot(state, attacker)
    else if (ball.side === attacker.side) start = ball.point
    else start = mirror(ball.point)

    const firstSequence = state.sequences.length
    let next: NextPossession | null = { side: attacker, point: start, source: 'open-play', fastBreak: false }
    for (let n = 0; next && n < TUNING.maxPossessionsPerMinute; n++) {
      const current: NextPossession = next
      const att: SideState = current.side
      const def: SideState = other(att)
      const factors = factorsFor(att)
      let result: PossessionResult
      if (current.corner) result = playCorner(state, att, def, minute, current.point.y, factors)
      else if (current.freeKick) result = playFreeKick(state, att, def, minute, current.point, factors)
      else result = playPossession(state, att, def, minute, current.point, current.source, current.fastBreak, factors)
      next = null

      if (result.corner) {
        next = { side: att, point: result.end, source: 'corner', fastBreak: false, corner: true }
        continue
      }
      switch (result.outcome) {
        case 'shot':
          // The keeper (or the kick-off) restarts: a dead ball with the defenders.
          state.ball = { side: def.side, point: { x: 0.06, y: 0.5 }, dead: true }
          break
        case 'foul-won':
          if (inFreeKickRange(result.end) && rng.chance(POSSESSION.freeKickDirectChance)) {
            next = { side: att, point: result.end, source: 'free-kick', fastBreak: false, freeKick: true }
          } else {
            // A quick restart from the spot.
            next = { side: att, point: result.end, source: 'open-play', fastBreak: false }
          }
          break
        case 'held':
          state.ball = { side: att.side, point: result.end, dead: false }
          break
        case 'corner-won':
          // Already handled through result.corner.
          break
        case 'turnover': {
          const won = mirror(result.end)
          const pace = def.profile.paceAttack / Math.max(att.profile.paceDefence, 1)
          const counterChance =
            POSSESSION.counterChance * def.tactics.counterFor * att.tactics.counterAgainst * Math.pow(pace, 0.7)
          if (result.counterable && won.x >= 0.45 && rng.chance(clamp(counterChance, 0, 0.9))) {
            next = { side: def, point: won, source: 'counter', fastBreak: true }
          } else {
            state.ball = { side: def.side, point: won, dead: false }
          }
          break
        }
      }
    }
    if (next) {
      // Out of time this minute: the ball stays live where the next possession would have started.
      state.ball = { side: next.side.side, point: next.point, dead: false }
    }
    stampSequenceTimes(state, firstSequence, minute)

    state.xgTimeline.push({
      minute,
      home: round2(home.stats.xg),
      away: round2(away.stats.xg),
    })
  }
}

/** Spread this minute's possessions (and their touches) across the minute. */
function stampSequenceTimes(state: HalftimeState, firstSequence: number, minute: number): void {
  const count = state.sequences.length - firstSequence
  if (count === 0) return
  const slice = 1 / count
  for (let k = 0; k < count; k++) {
    const seq = state.sequences[firstSequence + k]
    seq.t0 = round3(minute - 1 + k * slice)
    seq.t1 = round3(minute - 1 + (k + 1) * slice)
    const n = seq.points.length
    for (let i = 0; i < n; i++) {
      // Touches fill 85% of the window so consecutive possessions read as separate moves.
      seq.points[i].t = round3(seq.t0 + (n > 1 ? (i / (n - 1)) * slice * 0.85 : 0))
    }
  }
}

function newBall(): BallState {
  // Kick-off: the home side starts, dead ball at the centre spot.
  return { side: 'home', point: { x: 0.5, y: 0.5 }, dead: true }
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
    sequences: [],
    players: new Map(),
    ball: newBall(),
    sendOff,
    onGoal,
    lineupLog: [{ minute: 0, home: rosterOf(homeSheet.starters), away: rosterOf(awaySheet.starters) }],
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
 * Point a side at the sheet it plays on with. The new starters take the
 * pitch (minus anyone already sent off — a dismissal is permanent) and
 * strength re-anchors to the new lineup via the same computation initSide
 * and sendOff use, so an unchanged sheet reproduces the earlier numbers
 * exactly.
 */
function applySheet(side: SideState, sheet: TeamSheet, sentOff: ReadonlySet<string>): void {
  side.sheet = sheet
  side.onPitch = sheet.starters.filter((a) => !sentOff.has(a.player.id))
  const strength = computeAnchoredStrength(sheet, side.onPitch)
  side.strength = side.stats.reds > 0 ? shortHanded(strength) : strength
  side.profile = buildZoneProfile(side.onPitch)
  side.tactics = sideTactics(sheet)
}

function sameEleven(a: TeamSheet, b: TeamSheet): boolean {
  return a.starters.length === b.starters.length && a.starters.every((x, i) => x.player.id === b.starters[i].player.id && x.slot.id === b.starters[i].slot.id)
}

/**
 * Take a frozen match through a pause: apply the (possibly changed) sheets,
 * log the XIs when they changed (always at the break, so the scene knows
 * the sides switched ends), and restart play. At half-time the away side
 * kicks off; a substitution window keeps the ball where it was.
 */
function restartFromPause(state: HalftimeState, newHomeSheet: TeamSheet, newAwaySheet: TeamSheet): void {
  if (!isPauseMinute(state.minutesPlayed)) {
    throw new Error(
      `a match can only be resumed from ${PAUSE_MINUTES.join("', ")}', got ${state.minutesPlayed} minutes played`,
    )
  }
  const minute = state.minutesPlayed
  const changed = !sameEleven(state.home.sheet, newHomeSheet) || !sameEleven(state.away.sheet, newAwaySheet)
  const sentOff = sentOffIds(state)
  applySheet(state.home, newHomeSheet, sentOff)
  applySheet(state.away, newAwaySheet, sentOff)
  if (minute === HALFTIME_MINUTE || changed) {
    state.lineupLog.push({ minute, home: rosterOf(newHomeSheet.starters), away: rosterOf(newAwaySheet.starters) })
  }
  if (minute === HALFTIME_MINUTE) {
    // The away side kicks off the second half.
    state.ball = { side: 'away', point: { x: 0.5, y: 0.5 }, dead: true }
  }
}

/**
 * Continue a frozen match with (possibly changed) sheets up to the NEXT
 * pause minute and freeze it there again — the substitution windows.
 * Returns the same handle, now frozen at `until`.
 */
export function resumeUntil(
  state: HalftimeState,
  newHomeSheet: TeamSheet,
  newAwaySheet: TeamSheet,
  until: number,
): HalftimeState {
  if (!isPauseMinute(until) || until <= state.minutesPlayed) {
    throw new Error(`resumeUntil needs a later pause minute than ${state.minutesPlayed}', got ${until}'`)
  }
  restartFromPause(state, newHomeSheet, newAwaySheet)
  playMinutes(state, state.minutesPlayed + 1, until, { shotBoost: 1, cardBoost: 1 })
  return state
}

/**
 * Play out the rest of a match frozen at a pause with (possibly changed)
 * sheets. Continues the same rng and pushes onto the same event/timeline
 * arrays — nothing already played is re-rolled or rewritten. Consumes the
 * state; resuming the same handle twice is a bug.
 */
export function resumeMatch(state: HalftimeState, newHomeSheet: TeamSheet, newAwaySheet: TeamSheet): SimResult {
  restartFromPause(state, newHomeSheet, newAwaySheet)
  playMinutes(state, state.minutesPlayed + 1, TUNING.matchMinutes, { shotBoost: 1, cardBoost: 1 })
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
        `foul and card risk ×${TUNING.extraTimeCardBoost} for minutes 91–120.`,
    })
    state.ball = newBall()
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
        `Each kick converts at 75% baseline, adjusted up for the taker's shooting and down for the opposing keeper's quality.`,
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

  const playerStats: Record<string, PlayerMatchStats> = {}
  for (const [id, entry] of state.players) {
    playerStats[id] = { ...entry, xg: round2(entry.xg), xa: round2(entry.xa) }
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
    sequences: state.sequences,
    playerStats,
    lineupLog: state.lineupLog,
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
 * Snapshot a paused state for what-if replays: the mutable containers are
 * copied so a replay can't corrupt the live match, and the rng (with a fresh
 * commentator riding it) restarts from the given seed — Monte Carlo replays
 * sample many possible remainders rather than re-telling the live one.
 */
export function cloneHalftimeState(state: HalftimeState, seed: number): HalftimeState {
  const rng = createRng(seed)
  const players = new Map<string, PlayerMatchStats>()
  for (const [id, entry] of state.players) players.set(id, { ...entry })
  return {
    rng,
    commentary: createCommentator(rng),
    home: cloneSide(state.home),
    away: cloneSide(state.away),
    events: [...state.events],
    sequences: [...state.sequences],
    players,
    ball: { ...state.ball, point: { ...state.ball.point } },
    sendOff: state.sendOff,
    onGoal: state.onGoal,
    lineupLog: [...state.lineupLog],
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

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
