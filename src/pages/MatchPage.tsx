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
import { replayScript, withChange, type MatchScript } from '../services/matchScript'
import { continueMatch, kickOff, kickoffMonteCarlo } from '../services/simulation'
import { initialMatchState, matchAppReducer, type LineupState, type SideKey } from '../state/appState'
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

/**
 * The interactive match: kick off → play to the break → (optionally) the
 * substitution windows at 60' and 75' → the result. Every confirmed change
 * is appended to the match script, which is what the session keeps; the
 * insight Monte Carlo runs on the worker from kick-off and lands whenever
 * it is ready.
 */
function MatchFlow({ match }: { match: PlayedMatch }) {
  const [state, dispatch] = useReducer(matchAppReducer, match, initialMatchState)
  const [simulating, setSimulating] = useState(false)
  const [resuming, setResuming] = useState(false)
  // resume consumes the frozen state — a second call on the same handle must
  // never start, even before React has re-rendered with the result.
  const resumeGuard = useRef(false)
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]

  /** Store a Monte Carlo when it lands, unless the match was restarted meanwhile. */
  const scriptRef = useRef<MatchScript | null>(null)
  const requestMonteCarlo = useCallback(
    (script: MatchScript) => {
      scriptRef.current = script
      kickoffMonteCarlo(match, script.lineups)
        .then((monteCarlo) => {
          if (scriptRef.current?.seed === script.seed) dispatch({ type: 'monte-carlo', monteCarlo })
        })
        .catch(() => {
          /* The result page shows the insight only when it has one. */
        })
    },
    [match],
  )

  const kickOffMatch = useCallback(async () => {
    if (simulating) return
    setSimulating(true)
    try {
      // Yield so the pressed button paints its state before the first half is played.
      await new Promise((resolve) => setTimeout(resolve, 0))
      const live = kickOff(match, state.lineups)
      const script: MatchScript = { matchId: match.id, seed: live.seed, lineups: state.lineups, changes: [] }
      sessionSims.set(match.id, script)
      dispatch({ type: 'kickoff', live, script })
      requestMonteCarlo(script)
    } finally {
      setSimulating(false)
    }
  }, [simulating, state.lineups, match, requestMonteCarlo])

  /**
   * Play on from the current pause with (possibly changed) lineups: to the
   * next window when `until` is a minute, otherwise to the end.
   */
  const resume = useCallback(
    async (lineups: Record<SideKey, LineupState>, edited: boolean, until: number | null): Promise<boolean> => {
      if (!state.live || !state.script || state.sim || resumeGuard.current) return false
      resumeGuard.current = true
      setResuming(true)
      try {
        const pausedAt = state.live.minutesPlayed
        const script = edited ? withChange(state.script, pausedAt, lineups) : state.script
        const outcome = continueMatch(match, state.live, lineups, until)
        sessionSims.set(match.id, script)
        if ('finalScore' in outcome) dispatch({ type: 'finished', sim: outcome, script })
        else dispatch({ type: 'paused', live: outcome, script })
        return true
      } finally {
        resumeGuard.current = false
        setResuming(false)
      }
    },
    [state.live, state.script, state.sim, match],
  )

  /** To the result screen — playing out whatever remains, unchanged. */
  const finish = useCallback(async () => {
    if (!state.sim) {
      if (!state.live || !state.script) return
      const lineups = state.script.changes.length
        ? state.script.changes[state.script.changes.length - 1].lineups
        : state.script.lineups
      const ok = await resume(lineups, false, null)
      if (!ok) return
    }
    dispatch({ type: 'screen', screen: 'result' })
  }, [state.sim, state.live, state.script, resume])

  // Restore the last simulation of this match from the session store.
  useEffect(() => {
    const stored = sessionSims.get(match.id)
    if (!stored || state.sim) return
    let cancelled = false
    ;(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (cancelled) return
      const sim = replayScript(match, stored)
      dispatch({ type: 'restore', sim, monteCarlo: null, script: stored })
      requestMonteCarlo(stored)
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
              onKickOff={kickOffMatch}
              simulating={simulating}
            />
          </ScreenShell>
        )}
        {state.screen === 'match' && state.live && state.script && (
          <ScreenShell key="match">
            <MatchSim
              match={match}
              live={state.live}
              pausedAt={state.pausedAt ?? state.live.minutesPlayed}
              script={state.script}
              sim={state.sim}
              home={home}
              away={away}
              resuming={resuming}
              onResume={resume}
              onDone={finish}
            />
          </ScreenShell>
        )}
        {state.screen === 'result' && state.sim && state.script && (
          <ScreenShell key="result">
            <ResultScreen
              match={match}
              sim={state.sim}
              monteCarlo={state.monteCarlo}
              lineups={state.lineups}
              onEdit={() => dispatch({ type: 'screen', screen: 'editor' })}
              onRerun={kickOffMatch}
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
