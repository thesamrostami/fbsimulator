import type { PlayedMatch } from '../data/matches'
import { TEAMS } from '../data/teams'
import type { MatchEvent, PenaltyKick, SimResult } from '../engine/types'

/**
 * Full match report derived from one simulation: the complete timeline
 * (goals, cards, big chances, phase markers, substitution windows and every
 * shootout kick) plus a clean text rendering for the copy button. Pure —
 * and because simulations are seed-deterministic, a report can always be
 * re-derived identically from {seed, lineups}.
 */

/** Shots below this xG are routine efforts, not "big chances". */
export const BIG_CHANCE_XG = 0.2

const REPORT_TYPES = new Set<MatchEvent['type']>([
  'kickoff',
  'goal',
  'yellow-card',
  'red-card',
  'sub-window',
  'extra-time',
  'penalties',
  'full-time',
])

export type ReportEntry =
  | { kind: 'event'; event: MatchEvent }
  | { kind: 'kick'; kick: PenaltyKick; number: number }

export function reportEntries(sim: SimResult): ReportEntry[] {
  const entries: ReportEntry[] = []
  for (const event of sim.events) {
    const bigChance =
      (event.type === 'shot-saved' || event.type === 'shot-miss') && (event.xg ?? 0) >= BIG_CHANCE_XG
    if (REPORT_TYPES.has(event.type) || bigChance) {
      // The shootout kicks slot in between "penalties" and "full-time".
      if (event.type === 'full-time' && sim.shootout) {
        sim.shootout.kicks.forEach((kick, i) => entries.push({ kind: 'kick', kick, number: i + 1 }))
      }
      entries.push({ kind: 'event', event })
    }
  }
  return entries
}

const EVENT_GLYPH: Partial<Record<MatchEvent['type'], string>> = {
  kickoff: '📣',
  goal: '⚽',
  'shot-saved': '🧤',
  'shot-miss': '💨',
  'yellow-card': '🟨',
  'red-card': '🟥',
  'sub-window': '🔁',
  'extra-time': '⏳',
  penalties: '🎯',
  'full-time': '⏱',
}

export function buildMatchReport(match: PlayedMatch, sim: SimResult): { entries: ReportEntry[]; text: string } {
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]
  const entries = reportEntries(sim)

  const suffix = sim.shootout
    ? ` (${(sim.shootout.winner === 'home' ? home : away).shortName} win ${sim.shootout.score.home}–${sim.shootout.score.away} on pens)`
    : sim.wentToExtraTime
      ? ' (aet)'
      : ''

  const lines: string[] = [
    `MATCH REPORT · ${match.stage} · what-if replay`,
    `${home.name} ${sim.finalScore.home}–${sim.finalScore.away} ${away.name}${suffix}`,
    `Real result: ${match.real.score.home}–${match.real.score.away}${match.real.decidedBy ? ` (${match.real.decidedBy.toLowerCase()})` : ''}`,
    '',
  ]
  for (const entry of entries) {
    if (entry.kind === 'event') {
      const e = entry.event
      const teamTag = e.teamId ? ` [${e.teamId}]` : ''
      const scoreTag = e.type === 'goal' ? ` (${e.score.home}–${e.score.away})` : ''
      lines.push(`${String(e.minute).padStart(3)}' ${EVENT_GLYPH[e.type] ?? '·'}${teamTag} ${e.commentary}${scoreTag}`)
    } else {
      const k = entry.kick
      const mark = k.scored ? '✓' : '✗'
      lines.push(
        ` PK${entry.number} ${mark} [${k.side === 'home' ? home.shortName : away.shortName}] ${k.commentary} (${Math.round(k.chance * 100)}% odds${k.pressure ? ', must-score' : ''}) ${k.scoreAfter.home}–${k.scoreAfter.away}`,
      )
    }
  }
  lines.push('', `Seed ${sim.seed} — deterministic: this exact match can be replayed any time.`)
  return { entries, text: lines.join('\n') }
}
