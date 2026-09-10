import type { Line, PlayerMatchStats, RosterEntry, Side, SimResult } from '../engine/types'

/**
 * Post-match player ratings (the familiar 4.0–10.0 scale) from the engine's
 * per-player contributions: goals, assists, chance quality created and
 * taken, ball progression, defensive actions, saves, and discipline. Pure
 * and deterministic — the same match always rates the same. Used for the
 * ratings table and the Man of the Match on the result page.
 */

export interface PlayerRating {
  playerId: string
  name: string
  shirtNumber: number
  label: string
  line: Line
  side: Side
  /** Minutes on the pitch (from a restart to a red card or the final whistle). */
  minutes: number
  rating: number
  stats: PlayerMatchStats
}

export interface MatchRatings {
  home: PlayerRating[]
  away: PlayerRating[]
  /** Highest-rated player of the match (ties: more goals, then more assists). */
  motm: PlayerRating | null
}

/** The scoring weights, exposed for the methodology page. */
export const RATING_WEIGHTS = {
  base: 6.0,
  goal: 1.0,
  assist: 0.7,
  xg: 0.5,
  xa: 0.4,
  keyPass: 0.15,
  onTarget: 0.1,
  passCompleted: 0.02,
  passMissed: -0.03,
  carry: 0.04,
  tackle: 0.1,
  save: 0.3,
  foul: -0.08,
  foulWon: 0.04,
  yellow: -0.3,
  red: -1.5,
  /** Defenders and keepers share a clean-sheet bonus. */
  cleanSheet: 0.4,
  /** Everyone on the winning side gets a nudge; losers lose a little. */
  win: 0.15,
  loss: -0.15,
  min: 4.0,
  max: 10.0,
} as const

function emptyStats(playerId: string, side: Side): PlayerMatchStats {
  return {
    playerId,
    side,
    shots: 0,
    onTarget: 0,
    goals: 0,
    assists: 0,
    xg: 0,
    xa: 0,
    keyPasses: 0,
    passes: 0,
    passesCompleted: 0,
    carries: 0,
    tackles: 0,
    fouls: 0,
    foulsWon: 0,
    yellows: 0,
    red: false,
    saves: 0,
  }
}

function rate(stats: PlayerMatchStats, line: Line, conceded: number, result: 'win' | 'loss' | 'draw'): number {
  const w = RATING_WEIGHTS
  let r = w.base
  r += stats.goals * w.goal
  r += stats.assists * w.assist
  r += stats.xg * w.xg
  r += stats.xa * w.xa
  r += stats.keyPasses * w.keyPass
  r += stats.onTarget * w.onTarget
  r += stats.passesCompleted * w.passCompleted
  r += (stats.passes - stats.passesCompleted) * w.passMissed
  r += stats.carries * w.carry
  r += stats.tackles * w.tackle
  r += stats.saves * w.save
  r += stats.fouls * w.foul
  r += stats.foulsWon * w.foulWon
  r += stats.yellows * w.yellow
  if (stats.red) r += w.red
  if ((line === 'GK' || line === 'DEF') && conceded === 0) r += w.cleanSheet
  if (result === 'win') r += w.win
  if (result === 'loss') r += w.loss
  return Math.round(Math.min(w.max, Math.max(w.min, r)) * 10) / 10
}

/** Everyone who took the pitch, with the minute they came on. */
function appearances(sim: SimResult, side: Side): Map<string, { entry: RosterEntry; from: number }> {
  const seen = new Map<string, { entry: RosterEntry; from: number }>()
  for (const snapshot of sim.lineupLog) {
    for (const entry of snapshot[side]) {
      if (!seen.has(entry.playerId)) seen.set(entry.playerId, { entry, from: snapshot.minute })
    }
  }
  return seen
}

export function rateMatch(sim: SimResult): MatchRatings {
  const end = sim.wentToExtraTime ? 120 : 90
  const sentOff = new Map<string, number>()
  for (const e of sim.events) if (e.type === 'red-card' && e.player) sentOff.set(e.player.id, e.minute)

  const resultFor = (side: Side): 'win' | 'loss' | 'draw' => {
    const own = sim.finalScore[side]
    const other = sim.finalScore[side === 'home' ? 'away' : 'home']
    if (own !== other) return own > other ? 'win' : 'loss'
    if (sim.winner) return sim.winner === side ? 'win' : 'loss'
    return 'draw'
  }

  const rateSide = (side: Side): PlayerRating[] => {
    const conceded = sim.finalScore[side === 'home' ? 'away' : 'home']
    const result = resultFor(side)
    const rows: PlayerRating[] = []
    for (const { entry, from } of appearances(sim, side).values()) {
      const stats = sim.playerStats[entry.playerId] ?? emptyStats(entry.playerId, side)
      const off = sentOff.get(entry.playerId)
      // A player replaced at a later restart leaves at that restart.
      const replaced = sim.lineupLog.find(
        (snapshot) => snapshot.minute > from && !snapshot[side].some((p) => p.playerId === entry.playerId),
      )
      const to = Math.min(off ?? end, replaced?.minute ?? end)
      rows.push({
        playerId: entry.playerId,
        name: entry.name,
        shirtNumber: entry.shirtNumber,
        label: entry.label,
        line: entry.line,
        side,
        minutes: Math.max(0, to - from),
        rating: rate(stats, entry.line, conceded, result),
        stats,
      })
    }
    return rows.sort((a, b) => b.rating - a.rating || b.stats.goals - a.stats.goals || a.shirtNumber - b.shirtNumber)
  }

  const home = rateSide('home')
  const away = rateSide('away')
  const all = [...home, ...away].sort(
    (a, b) => b.rating - a.rating || b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists,
  )
  return { home, away, motm: all[0] ?? null }
}

/** Passes completed as a percentage, or null with nothing attempted. */
export function passAccuracy(stats: { passes: number; passesCompleted: number }): number | null {
  return stats.passes > 0 ? Math.round((stats.passesCompleted / stats.passes) * 100) : null
}
