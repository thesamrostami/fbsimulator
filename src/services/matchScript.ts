import type { PlayedMatch } from '../data/matches'
import { HALFTIME_MINUTE, PAUSE_MINUTES, playFirstHalf, resumeMatch, resumeUntil, type HalftimeState } from '../engine/simulate'
import type { SimResult } from '../engine/types'
import { buildSheet, type LineupState, type SideKey } from '../state/appState'
import { matchSimOptions } from './simOptions'

/**
 * A whole interactive match as data: the seed, the kick-off lineups and
 * every change confirmed at a pause. Replaying a script reproduces the
 * match byte for byte (the engine is deterministic and pausing with
 * unchanged sheets is a no-op), so this is what the session stores, what a
 * Worker rebuilds a paused state from, and what a share link could carry.
 */

export interface ScriptChange {
  /** The pause the change was confirmed at (45, 60 or 75). */
  minute: number
  /** The full lineups from that minute on. */
  lineups: Record<SideKey, LineupState>
}

export interface MatchScript {
  matchId: string
  seed: number
  lineups: Record<SideKey, LineupState>
  changes: ScriptChange[]
}

/** The lineups in force at a minute (after any change confirmed at that minute). */
export function lineupsAt(script: MatchScript, minute: number): Record<SideKey, LineupState> {
  let current = script.lineups
  for (const change of script.changes) if (change.minute <= minute) current = change.lineups
  return current
}

/** A script with one more confirmed change (replacing any earlier entry for the same minute). */
export function withChange(script: MatchScript, minute: number, lineups: Record<SideKey, LineupState>): MatchScript {
  return { ...script, changes: [...script.changes.filter((c) => c.minute !== minute), { minute, lineups }].sort((a, b) => a.minute - b.minute) }
}

function xiOf(lineup: LineupState): Set<string> {
  return new Set(Object.values(lineup.startersBySlot))
}

/**
 * Substitution ledger for one side across the confirmed changes: how many
 * fresh players have come on, and who has left the pitch (a substituted
 * player cannot return).
 */
export function substitutionLedger(script: MatchScript, side: SideKey): { used: number; off: Set<string> } {
  let previous = xiOf(script.lineups[side])
  let used = 0
  const off = new Set<string>()
  for (const change of script.changes) {
    const next = xiOf(change.lineups[side])
    for (const id of next) if (!previous.has(id)) used += 1
    for (const id of previous) if (!next.has(id)) off.add(id)
    previous = next
  }
  return { used, off }
}

/** The next pause after `minute`, or null when the match runs to the end. */
export function nextPauseAfter(minute: number): number | null {
  for (const p of PAUSE_MINUTES) if (p > minute) return p
  return null
}

/**
 * Rebuild the live handle frozen at `until` from a script: kick off, then
 * pass through every pause up to there with the lineups in force.
 */
export function playScriptUntil(match: PlayedMatch, script: MatchScript, until: number): HalftimeState {
  const options = matchSimOptions(match)
  const sheetsAt = (minute: number) => {
    const l = lineupsAt(script, minute)
    return { home: buildSheet(match.home, l.home), away: buildSheet(match.away, l.away) }
  }
  const start = sheetsAt(0)
  const live = playFirstHalf(start.home, start.away, script.seed, options)
  let at = HALFTIME_MINUTE
  while (at < until) {
    const next = nextPauseAfter(at)
    if (next === null || next > until) break
    const sheets = sheetsAt(at)
    resumeUntil(live, sheets.home, sheets.away, next)
    at = next
  }
  if (live.minutesPlayed !== until) throw new Error(`cannot freeze a match at ${until}'`)
  return live
}

/** Replay a whole script to its final result. */
export function replayScript(match: PlayedMatch, script: MatchScript): SimResult {
  const lastPause = script.changes.length > 0 ? script.changes[script.changes.length - 1].minute : HALFTIME_MINUTE
  const live = playScriptUntil(match, script, lastPause)
  const l = lineupsAt(script, lastPause)
  return resumeMatch(live, buildSheet(match.home, l.home), buildSheet(match.away, l.away))
}
