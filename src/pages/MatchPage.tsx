import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LineupEditor } from '../components/screens/LineupEditor'
import { MatchSim } from '../components/screens/MatchSim'
import { ResultScreen } from '../components/screens/ResultScreen'
import { TeamFlag } from '../components/ui/TeamFlag'
import { FOCUS_RING } from '../ui/theme'
import { getMatch, type PlayedMatch } from '../data/matches'
import { TEAMS } from '../data/teams'
import { runSimulation } from '../services/simulation'
import { buildSheet, initialMatchState, matchAppReducer } from '../state/appState'
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
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]

  const kickOff = useCallback(async () => {
    if (simulating) return
    setSimulating(true)
    try {
      const homeSheet = buildSheet(match.home, state.lineups.home)
      const awaySheet = buildSheet(match.away, state.lineups.away)
      const { sim, monteCarlo } = await runSimulation(homeSheet, awaySheet, {
        knockout: true,
        homePossession: match.real.possession.home / 100,
      })
      // Seed + lineups fully determine the sim: enough to re-derive the
      // match report if the user navigates away and back this session.
      sessionSims.set(match.id, { seed: sim.seed, lineups: state.lineups })
      dispatch({ type: 'results', sim, monteCarlo })
    } finally {
      setSimulating(false)
    }
  }, [simulating, state.lineups, match])

  // Restore the last simulation of this match from the session store.
  useEffect(() => {
    const stored = sessionSims.get(match.id)
    if (!stored || state.sim) return
    let cancelled = false
    ;(async () => {
      const homeSheet = buildSheet(match.home, stored.lineups.home)
      const awaySheet = buildSheet(match.away, stored.lineups.away)
      const { sim, monteCarlo } = await runSimulation(
        homeSheet,
        awaySheet,
        { knockout: true, homePossession: match.real.possession.home / 100 },
        stored.seed,
      )
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
              state={state}
              dispatch={dispatch}
              onKickOff={kickOff}
              simulating={simulating}
            />
          </ScreenShell>
        )}
        {state.screen === 'match' && state.sim && (
          <ScreenShell key="match">
            <MatchSim
              sim={state.sim}
              home={home}
              away={away}
              onDone={() => dispatch({ type: 'screen', screen: 'result' })}
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
