import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LineupEditor } from '../components/screens/LineupEditor'
import { MatchSim } from '../components/screens/MatchSim'
import { ResultScreen } from '../components/screens/ResultScreen'
import { TeamFlag } from '../components/ui/TeamFlag'
import { FOCUS_RING } from '../ui/theme'
import { getMatch, type PlayedMatch } from '../data/matches'
import { TEAMS } from '../data/teams'
import type { SimResult } from '../engine/types'
import { matchSimOptions, resumeSecondHalf, runFirstHalf, runSimulation } from '../services/simulation'
import { buildSheet, initialMatchState, matchAppReducer, type LineupState, type SideKey } from '../state/appState'
import { sessionSims } from '../state/sessionStore'

function ScreenShell({ children }: { children: ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -56 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className="px-4 pb-12"
    >
      {children}
    </motion.main>
  )
}

function realScoreLabel(match: PlayedMatch): string {
  const { score, decidedBy } = match.real
  const suffix = decidedBy === 'PENS' ? ' pens' : decidedBy === 'AET' ? ' aet' : ''
  return `${score.home}–${score.away}${suffix}`
}

function MatchFlow({ match }: { match: PlayedMatch }) {
  const [state, dispatch] = useReducer(matchAppReducer, match, initialMatchState)
  const [simulating, setSimulating] = useState(false)
  const [resuming, setResuming] = useState(false)
  // resumeMatch consumes the frozen state — a second call on the same handle
  // must never start, even before React has re-rendered with the result.
  const resumeGuard = useRef(false)
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]

  const kickOff = useCallback(async () => {
    if (simulating) return
    setSimulating(true)
    try {
      const homeSheet = buildSheet(match.home, state.lineups.home)
      const awaySheet = buildSheet(match.away, state.lineups.away)
      const { firstHalf, monteCarlo } = await runFirstHalf(homeSheet, awaySheet, matchSimOptions(match))
      // Seed + lineups re-derive an unchanged match for the session store; a
      // half-time edit overwrites this entry with the exact result later.
      sessionSims.set(match.id, { seed: firstHalf.seed, lineups: state.lineups })
      dispatch({ type: 'first-half', firstHalf, monteCarlo })
    } finally {
      setSimulating(false)
    }
  }, [simulating, state.lineups, match])

  /** Play the second half from the paused state, with or without changes. */
  const resume = useCallback(
    async (halftimeLineups: Record<SideKey, LineupState>, edited: boolean): Promise<SimResult | null> => {
      if (!state.firstHalf || state.sim || resumeGuard.current) return null
      resumeGuard.current = true
      setResuming(true)
      try {
        // Unchanged: reuse the very sheets the first half was played with.
        const homeSheet = edited ? buildSheet(match.home, halftimeLineups.home) : state.firstHalf.home.sheet
        const awaySheet = edited ? buildSheet(match.away, halftimeLineups.away) : state.firstHalf.away.sheet
        const sim = await resumeSecondHalf(state.firstHalf, homeSheet, awaySheet)
        if (edited && state.monteCarlo) {
          // Seed + kickoff lineups no longer reproduce this match — keep the result itself.
          sessionSims.set(match.id, {
            seed: sim.seed,
            lineups: state.lineups,
            halftime: { sim, monteCarlo: state.monteCarlo },
          })
        }
        dispatch({ type: 'second-half', sim })
        return sim
      } finally {
        resumeGuard.current = false
        setResuming(false)
      }
    },
    [state.firstHalf, state.sim, state.monteCarlo, state.lineups, match],
  )

  /** To the result screen — playing out an untouched second half first if needed. */
  const finish = useCallback(async () => {
    if (!state.sim) {
      const sim = await resume(state.lineups, false)
      if (!sim) return
    }
    dispatch({ type: 'screen', screen: 'result' })
  }, [state.sim, state.lineups, resume])

  // Restore the last simulation of this match from the session store.
  useEffect(() => {
    const stored = sessionSims.get(match.id)
    if (!stored || state.sim) return
    // A half-time-edited match can't be re-derived from seed+lineups: restore
    // the stored result directly (module memory, so the objects are intact).
    if (stored.halftime) {
      dispatch({
        type: 'restore',
        sim: stored.halftime.sim,
        monteCarlo: stored.halftime.monteCarlo,
        lineups: stored.lineups,
      })
      return
    }
    let cancelled = false
    ;(async () => {
      const homeSheet = buildSheet(match.home, stored.lineups.home)
      const awaySheet = buildSheet(match.away, stored.lineups.away)
      const { sim, monteCarlo } = await runSimulation(homeSheet, awaySheet, matchSimOptions(match), stored.seed)
      if (!cancelled) dispatch({ type: 'restore', sim, monteCarlo, lineups: stored.lineups })
    })()
    return () => {
      cancelled = true
    }
    // Mount-per-match only (MatchFlow is keyed by match id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  return (
    <div className="min-h-full">
      <header className="px-4 pb-6 pt-8 text-center">
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.3em] text-muted">
            <Link to="/bracket" className={`rounded transition-colors hover:text-floodlight ${FOCUS_RING}`}>
              ◂ Bracket
            </Link>
            <span className="mx-2">·</span>
            {match.stage} · {match.date}
          </div>
          <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-display text-2xl font-black uppercase tracking-tight text-floodlight sm:text-4xl">
            <TeamFlag teamId={home.id} className="h-5 sm:h-6" title="" />
            <span style={{ color: home.color }}>{home.name}</span>
            <span className="text-muted">vs</span>
            <span style={{ color: away.color }}>{away.name}</span>
            <TeamFlag teamId={away.id} className="h-5 sm:h-6" title="" />
          </h1>
          <p className="mt-1 text-sm text-muted">
            Real result: {home.name} {realScoreLabel(match)} {away.name} — now change history.
          </p>
        </motion.div>
      </header>

      <AnimatePresence mode="wait">
        {state.screen === 'editor' && (
          <ScreenShell key="editor">
            <LineupEditor
              match={match}
              lineups={state.lineups}
              dispatch={dispatch}
              onKickOff={kickOff}
              simulating={simulating}
            />
          </ScreenShell>
        )}
        {state.screen === 'match' && state.firstHalf && (
          <ScreenShell key="match">
            <MatchSim
              match={match}
              firstHalf={state.firstHalf}
              sim={state.sim}
              lineups={state.lineups}
              home={home}
              away={away}
              resuming={resuming}
              onResume={resume}
              onDone={finish}
            />
          </ScreenShell>
        )}
        {state.screen === 'result' && state.sim && state.monteCarlo && (
          <ScreenShell key="result">
            <ResultScreen
              match={match}
              sim={state.sim}
              monteCarlo={state.monteCarlo}
              lineups={state.lineups}
              onEdit={() => dispatch({ type: 'screen', screen: 'editor' })}
              onRerun={kickOff}
              rerunning={simulating}
            />
          </ScreenShell>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MatchPage() {
  const { id } = useParams()
  const match = getMatch(id)

  if (!match || !match.played) {
    return <Navigate to="/bracket" replace />
  }

  // Keyed by id so navigating between matches resets the flow cleanly.
  return <MatchFlow key={match.id} match={match} />
}
