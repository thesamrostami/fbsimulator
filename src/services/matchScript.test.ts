import { describe, expect, it } from 'vitest'
import { MATCHES, type PlayedMatch } from '../data/matches'
import { runSecondHalfMonteCarlo } from '../engine/monteCarlo'
import { resumeUntil } from '../engine/simulate'
import { buildSheet, initialMatchState, makePauseReducer, matchAppReducer, MAX_HALFTIME_SUBS, type LineupState, type MatchAppState, type SideKey } from '../state/appState'
import { lineupsAt, nextPauseAfter, playScriptUntil, replayScript, substitutionLedger, withChange, type MatchScript } from './matchScript'
import { requestMonteCarlo, resetMonteCarloClient } from './monteCarloClient'
import { continueMatch, kickOff, pauseInsight } from './simulation'
import { INSIGHT_SEED, MONTE_CARLO_RUNS } from './simOptions'

const match = MATCHES['r16-4'] as PlayedMatch
const kickoffLineups = initialMatchState(match).lineups

/**
 * Bench `n` outfield starters (from slot offset `from`) for fresh bench
 * outfielders — never a keeper, never anyone in `exclude` (already off).
 */
function subbed(
  lineups: Record<SideKey, LineupState>,
  side: SideKey,
  n: number,
  from = 0,
  exclude: ReadonlySet<string> = new Set(),
): Record<SideKey, LineupState> {
  let state: MatchAppState = { screen: 'editor', lineups, live: null, pausedAt: null, script: null, sim: null, monteCarlo: null }
  const slots = Object.keys(lineups[side].startersBySlot).filter((id) => id !== 'gk').slice(from, from + n)
  const benchOutfield = lineups[side].bench
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => !/trafford|rangel|fernandez|pickford/.test(id) && !exclude.has(id))
  slots.forEach((slotId, i) => {
    state = matchAppReducer(state, { type: 'swap', side, a: { kind: 'slot', slotId }, b: { kind: 'bench', index: benchOutfield[i].index } })
  })
  return state.lineups
}

describe('match script', () => {
  it('replays the live flow with changes at 45 and 60 byte for byte', () => {
    const live = kickOff(match, kickoffLineups, 4321)
    const script0: MatchScript = { matchId: match.id, seed: 4321, lineups: kickoffLineups, changes: [] }
    // Half-time: a Mexico change, then play to 60.
    const at45 = subbed(kickoffLineups, 'home', 2)
    const script1 = withChange(script0, 45, at45)
    const paused60 = continueMatch(match, live, at45, 60)
    expect('finalScore' in paused60).toBe(false)
    // 60': an England change, then play out.
    const at60 = subbed(at45, 'away', 1, 3)
    const script2 = withChange(script1, 60, at60)
    const sim = continueMatch(match, live, at60, null)
    expect('finalScore' in sim).toBe(true)

    expect(replayScript(match, script2)).toEqual(sim)
    // Serialising the script changes nothing.
    expect(replayScript(match, JSON.parse(JSON.stringify(script2)) as MatchScript)).toEqual(sim)
    // The lineup log carries every restart the scene needs.
    expect((sim as { lineupLog: { minute: number }[] }).lineupLog.map((s) => s.minute)).toEqual([0, 45, 60])
  })

  it('freezes a scripted match at any window and matches the live handle', () => {
    const script: MatchScript = withChange(
      { matchId: match.id, seed: 99, lineups: kickoffLineups, changes: [] },
      45,
      subbed(kickoffLineups, 'away', 1),
    )
    const rebuilt = playScriptUntil(match, script, 75)
    const live = kickOff(match, kickoffLineups, 99)
    const at45 = lineupsAt(script, 45)
    resumeUntil(live, buildSheet(match.home, at45.home), buildSheet(match.away, at45.away), 60)
    resumeUntil(live, buildSheet(match.home, at45.home), buildSheet(match.away, at45.away), 75)
    expect(rebuilt.minutesPlayed).toBe(75)
    expect(rebuilt.events).toEqual(live.events)
    expect(rebuilt.home.goals).toBe(live.home.goals)
    expect(() => playScriptUntil(match, script, 50)).toThrow()
  })

  it('keeps a substitution ledger: fresh players count, players who left cannot return', () => {
    const script0: MatchScript = { matchId: match.id, seed: 1, lineups: kickoffLineups, changes: [] }
    const at45 = subbed(kickoffLineups, 'home', 2)
    const off45 = substitutionLedger(withChange(script0, 45, at45), 'home').off
    const script = withChange(withChange(script0, 45, at45), 60, subbed(at45, 'home', 1, 2, off45))
    const ledger = substitutionLedger(script, 'home')
    expect(ledger.used).toBe(3)
    expect(ledger.off.size).toBe(3)
    expect(substitutionLedger(script, 'away').used).toBe(0)
    expect(lineupsAt(script, 44)).toBe(kickoffLineups)
    expect(lineupsAt(script, 45)).toBe(at45)
    expect(nextPauseAfter(45)).toBe(60)
    expect(nextPauseAfter(75)).toBeNull()

    // The 75' editor: two subs left, and the three who left are unavailable.
    const baseline = lineupsAt(script, 75)
    const reducer = makePauseReducer(baseline, { used: { home: 3, away: 0 }, unavailable: { home: ledger.off, away: new Set() } })
    let draft = baseline
    const outfieldSlots = Object.keys(baseline.home.startersBySlot).filter((id) => id !== 'gk')
    const freshBench = baseline.home.bench
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !ledger.off.has(id) && !/rangel|fernandez/.test(id))
    draft = reducer(draft, { type: 'swap', side: 'home', a: { kind: 'slot', slotId: outfieldSlots[5] }, b: { kind: 'bench', index: freshBench[0].index } })
    draft = reducer(draft, { type: 'swap', side: 'home', a: { kind: 'slot', slotId: outfieldSlots[6] }, b: { kind: 'bench', index: freshBench[1].index } })
    expect(Object.values(draft.home.startersBySlot)).toContain(freshBench[0].id)
    expect(Object.values(draft.home.startersBySlot)).toContain(freshBench[1].id)
    // A sixth substitution is refused outright.
    const before = draft
    draft = reducer(draft, { type: 'swap', side: 'home', a: { kind: 'slot', slotId: outfieldSlots[7] }, b: { kind: 'bench', index: freshBench[2].index } })
    expect(draft).toBe(before)
    // So is bringing back a player who was substituted off.
    const gone = [...ledger.off][0]
    const goneIndex = draft.home.bench.indexOf(gone)
    expect(goneIndex).toBeGreaterThanOrEqual(0)
    draft = reducer(draft, { type: 'swap', side: 'home', a: { kind: 'slot', slotId: outfieldSlots[7] }, b: { kind: 'bench', index: goneIndex } })
    expect(draft).toBe(before)
    expect(MAX_HALFTIME_SUBS).toBe(5)
  })
})

describe('Monte Carlo client without a Worker', () => {
  it('serves requests in-thread with the exact engine result', async () => {
    resetMonteCarloClient()
    expect(typeof Worker).toBe('undefined')
    const script: MatchScript = { matchId: match.id, seed: 7, lineups: kickoffLineups, changes: [] }
    const edited = subbed(kickoffLineups, 'away', 3)
    const runs = await pauseInsight(match, script, 45, edited)
    const live = playScriptUntil(match, script, 45)
    const direct = runSecondHalfMonteCarlo(
      live,
      buildSheet(match.home, edited.home),
      buildSheet(match.away, edited.away),
      MONTE_CARLO_RUNS,
      INSIGHT_SEED,
    )
    expect(runs.edited).toEqual(direct)
    expect(runs.unchanged.homeWinPct + runs.unchanged.awayWinPct).toBeCloseTo(100, 0)
    const full = await requestMonteCarlo({ kind: 'full', matchId: match.id, lineups: kickoffLineups, runs: 50, seed: 3 })
    expect(full.runs).toBe(50)
    await expect(requestMonteCarlo({ kind: 'full', matchId: 'nope', lineups: kickoffLineups, runs: 1, seed: 1 })).rejects.toThrow()
  }, 30000)
})
