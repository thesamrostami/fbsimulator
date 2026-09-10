/// <reference lib="webworker" />
import { getMatch, type PlayedMatch } from '../data/matches'
import { runMonteCarlo, runSecondHalfMonteCarlo } from '../engine/monteCarlo'
import type { MonteCarloResult } from '../engine/types'
import { buildSheet, type LineupState, type SideKey } from '../state/appState'
import { playScriptUntil, type MatchScript } from './matchScript'
import { matchSimOptions } from './simOptions'

/**
 * Monte Carlo off the main thread. The engine is pure and lineups are plain
 * data, so a request is just ids and numbers; the worker rebuilds the sheets
 * (and, for a paused match, replays the script to the pause) and answers
 * with the result. Requests carry an id so stale answers can be ignored.
 */

export type McRequest =
  | { id: number; kind: 'full'; matchId: string; lineups: Record<SideKey, LineupState>; runs: number; seed: number }
  | {
      id: number
      kind: 'remainder'
      matchId: string
      script: MatchScript
      pausedAt: number
      /** The lineups to play the remainder with (the script's own at `pausedAt` for the baseline). */
      lineups: Record<SideKey, LineupState>
      runs: number
      seed: number
    }

export type McResponse = { id: number; result: MonteCarloResult } | { id: number; error: string }

function playedMatch(matchId: string): PlayedMatch {
  const match = getMatch(matchId)
  if (!match || !match.played) throw new Error(`unknown match ${matchId}`)
  return match
}

/** The work itself, shared with the in-thread fallback. */
export function serve(request: McRequest): MonteCarloResult {
  const match = playedMatch(request.matchId)
  if (request.kind === 'full') {
    return runMonteCarlo(
      buildSheet(match.home, request.lineups.home),
      buildSheet(match.away, request.lineups.away),
      request.runs,
      request.seed,
      matchSimOptions(match),
    )
  }
  const live = playScriptUntil(match, request.script, request.pausedAt)
  return runSecondHalfMonteCarlo(
    live,
    buildSheet(match.home, request.lineups.home),
    buildSheet(match.away, request.lineups.away),
    request.runs,
    request.seed,
  )
}

// Only wire the message loop when actually running as a worker (no window).
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event: MessageEvent<McRequest>) => {
    const request = event.data
    try {
      const response: McResponse = { id: request.id, result: serve(request) }
      self.postMessage(response)
    } catch (error) {
      const response: McResponse = { id: request.id, error: error instanceof Error ? error.message : String(error) }
      self.postMessage(response)
    }
  }
}
