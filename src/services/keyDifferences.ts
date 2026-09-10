import type { PlayedMatch } from '../data/matches'
import { TEAMS, type TeamInfo } from '../data/teams'
import type { MatchEvent, MonteCarloResult, SimResult } from '../engine/types'
import type { PlayerRating } from './playerRatings'

export interface KeyDifference {
  /** Emoji icon; ignored when teamId is set (the UI renders that team's flag). */
  icon: string
  /** Set when the line is about one team — the UI shows its flag as the icon. */
  teamId?: TeamInfo['id']
  text: string
}

function firstGoal(events: MatchEvent[], teamId: string): MatchEvent | undefined {
  return events.find((e) => e.type === 'goal' && e.teamId === teamId)
}

function realScoreText(match: PlayedMatch): string {
  const suffix =
    match.real.decidedBy === 'PENS' ? ' (pens)' : match.real.decidedBy === 'AET' ? ' (aet)' : ''
  return `${match.real.score.home}–${match.real.score.away}${suffix}`
}

function simOutcome(sim: SimResult, home: TeamInfo, away: TeamInfo): { winner: TeamInfo | null; how: string } {
  if (sim.finalScore.home !== sim.finalScore.away) {
    const winner = sim.finalScore.home > sim.finalScore.away ? home : away
    return { winner, how: sim.wentToExtraTime ? 'after extra time' : 'in 90 minutes' }
  }
  if (sim.shootout) {
    const winner = sim.shootout.winner === 'home' ? home : away
    return { winner, how: `on penalties (${sim.shootout.score.home}–${sim.shootout.score.away})` }
  }
  return { winner: null, how: '' }
}

/**
 * Narrative comparison between the real match and one simulated replay.
 * Pure so it can be unit-tested or moved server-side with the engine.
 */
export function buildKeyDifferences(match: PlayedMatch, sim: SimResult): KeyDifference[] {
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]
  const real = match.real
  const diffs: KeyDifference[] = []
  const yours = sim.finalScore

  const realWinner =
    real.score.home > real.score.away
      ? home
      : real.score.away > real.score.home
        ? away
        : real.pensWinner
          ? real.pensWinner === 'home'
            ? home
            : away
          : null

  const { winner: simWinner, how } = simOutcome(sim, home, away)
  const scoreline = `${home.name} ${yours.home}–${yours.away} ${away.name}`
  if (simWinner && realWinner && simWinner.id === realWinner.id) {
    diffs.push({
      icon: '🏆',
      teamId: simWinner.id,
      text: `History holds: ${simWinner.name} go through again, ${how} — ${scoreline}. Real result: ${realScoreText(match)}.`,
    })
  } else if (simWinner) {
    diffs.push({
      icon: '🏆',
      teamId: simWinner.id,
      text: `History rewritten! ${simWinner.name} win ${how} — ${scoreline} — where the real match finished ${realScoreText(match)}.`,
    })
  } else {
    diffs.push({
      icon: '⚖️',
      text: `All square at ${yours.home}–${yours.away}. In reality it finished ${realScoreText(match)}.`,
    })
  }

  for (const team of [home, away]) {
    const realFirst = real.goals.find((g) => g.teamId === team.id)
    const simFirst = firstGoal(sim.events, team.id)
    if (realFirst && simFirst) {
      const scorer = realFirst.player ? `through ${realFirst.player} ` : ''
      diffs.push({
        icon: '⚽',
        text: `${team.name} really opened their account ${scorer}on ${realFirst.minute}'. In your version it was ${simFirst.player?.name ?? 'an unmarked man'} on ${simFirst.minute}'.`,
      })
    } else if (realFirst && !simFirst) {
      const scorer = realFirst.player ? ` (${realFirst.player}, ${realFirst.minute}')` : ` (${realFirst.minute}')`
      diffs.push({
        icon: '⚽',
        text: `${team.name} scored in the real match${scorer} — this time they drew a blank.`,
      })
    } else if (!realFirst && simFirst) {
      diffs.push({
        icon: '⚽',
        text: `${team.name} never scored in reality, but here ${simFirst.player?.name ?? 'someone'} broke through on ${simFirst.minute}'.`,
      })
    }
  }

  const simReds = sim.events.filter((e) => e.type === 'red-card')
  const realRed = real.redCards[0]
  if (realRed && simReds.length === 0) {
    const realRedTeam = TEAMS[realRed.teamId]
    diffs.push({
      icon: '🟥',
      text: `The real match turned when ${realRed.player} (${realRedTeam.name}) saw red on ${realRed.minute}'. In your version everyone kept their head — no red cards.`,
    })
  } else if (simReds.length > 0) {
    const red = simReds[0]
    const team = red.teamId === home.id ? home : away
    const realNote = realRed
      ? `In reality it was ${realRed.player} (${TEAMS[realRed.teamId].name}) on ${realRed.minute}'.`
      : `The real match had none.`
    diffs.push({
      icon: '🟥',
      text: `A red card — ${red.player?.name ?? 'a defender'} (${team.name}) on ${red.minute}'. ${realNote}`,
    })
  }

  if (sim.shootout) {
    const realPens = real.decidedBy === 'PENS'
    diffs.push({
      icon: '🥅',
      text: `Your replay went all the way to a shootout${realPens ? ' — just like the real night' : ', which the real match never needed'}.`,
    })
  } else if (real.decidedBy === 'PENS') {
    diffs.push({
      icon: '🥅',
      text: `The real tie needed penalties to separate them. Your version was settled ${sim.wentToExtraTime ? 'in extra time' : 'inside 90 minutes'}.`,
    })
  } else if (sim.wentToExtraTime && real.decidedBy !== 'AET') {
    diffs.push({
      icon: '⏳',
      text: `Your changes dragged this one to extra time — the real match was done in 90.`,
    })
  } else if (!sim.wentToExtraTime && real.decidedBy === 'AET') {
    diffs.push({
      icon: '⏳',
      text: `The real match needed extra time; your version was settled in 90 minutes.`,
    })
  }

  diffs.push({
    icon: '🎯',
    text: `Real shot count: ${real.shots.home.total}–${real.shots.away.total} (${home.shortName} first). Your replay: ${sim.stats.home.shots}–${sim.stats.away.shots} shots, xG ${sim.stats.home.xg.toFixed(1)}–${sim.stats.away.xg.toFixed(1)}.`,
  })

  return diffs
}

export function shareSummary(
  match: PlayedMatch,
  sim: SimResult,
  monteCarlo: MonteCarloResult,
  topScoreline: string,
  motm?: PlayerRating | null,
): string {
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]
  const pens = sim.shootout ? ` (${sim.shootout.score.home}–${sim.shootout.score.away} pens)` : ''
  const aet = sim.wentToExtraTime && !sim.shootout ? ' (aet)' : ''
  return [
    `THE REPLAY CUP · ${match.stage} replay`,
    `${home.name} ${sim.finalScore.home}–${sim.finalScore.away} ${away.name}${aet}${pens} (my simulation)`,
    `Reality: ${home.name} ${realScoreText(match)} ${away.name}`,
    `xG ${sim.stats.home.xg.toFixed(2)}–${sim.stats.away.xg.toFixed(2)} · shots ${sim.stats.home.shots}–${sim.stats.away.shots}`,
    ...(motm ? [`Man of the match: ${motm.name} (${motm.side === 'home' ? home.shortName : away.shortName}) ${motm.rating.toFixed(1)}`] : []),
    `1,000 replays: ${home.shortName} ${monteCarlo.homeWinPct}%${monteCarlo.extraTimePct === undefined ? ` · Draw ${monteCarlo.drawPct}%` : ''} · ${away.shortName} ${monteCarlo.awayWinPct}%`,
    `Most common scoreline: ${topScoreline}`,
  ].join('\n')
}
