import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayedMatch } from '../../data/matches'
import type { TeamInfo } from '../../data/teams'
import { HALFTIME_MINUTE, type HalftimeState } from '../../engine/simulate'
import type { MatchEvent, SimResult } from '../../engine/types'
import type { LineupState, SideKey } from '../../state/appState'
import { EventCard } from '../match/EventCard'
import { GoalCelebration } from '../match/GoalCelebration'
import { HalftimeBreak } from '../match/HalftimeBreak'
import { PenaltyShootout } from '../match/PenaltyShootout'
import { XgRaceChart } from '../match/XgRaceChart'
import { TeamFlag } from '../ui/TeamFlag'
import { FOCUS_RING } from '../../ui/theme'

interface MatchSimProps {
  match: PlayedMatch
  /** The live match, played to 45' at kickoff. Its arrays grow in place at resume. */
  firstHalf: HalftimeState
  /** The full result — null until the second half has been kicked off. */
  sim: SimResult | null
  /** The lineups that started the match: the half-time editor's baseline. */
  lineups: Record<SideKey, LineupState>
  home: TeamInfo
  away: TeamInfo
  resuming: boolean
  onResume: (lineups: Record<SideKey, LineupState>, edited: boolean) => void
  onDone: () => void
}

/** Playback pace: match minutes per real second at 1x. 90' in 18s. */
const MINUTES_PER_SECOND = 5
const SPEEDS = [1, 2, 4] as const

function AnimatedDigit({ value, color }: { value: number; color: string }) {
  return (
    <span className="relative inline-flex h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="absolute inset-0 text-center"
          style={{ color }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function MatchSim({ match, firstHalf, sim, lineups, home, away, resuming, onResume, onDone }: MatchSimProps) {
  const duration = sim?.wentToExtraTime ? 120 : 90
  const [minute, setMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [celebration, setCelebration] = useState<MatchEvent | null>(null)
  const [atBreak, setAtBreak] = useState(false)
  const celebratedCount = useRef(0)

  // The engine grows the first half's arrays in place at resume, so sim.events
  // IS firstHalf.events. Copy once when the second half lands to give memos
  // (and the xG chart's y-scale) a fresh identity — the copy keeps every
  // element and its order, so the feed appends from 46' instead of resetting.
  const events = useMemo(() => (sim ? [...sim.events] : firstHalf.events), [sim, firstHalf])
  const xgTimeline = useMemo(() => (sim ? [...sim.xgTimeline] : firstHalf.xgTimeline), [sim, firstHalf])

  const finished = sim !== null && minute >= duration
  const showShootout = finished && sim?.shootout !== undefined
  // With no second half yet, the playhead can't pass the whistle.
  const cap = sim ? duration : HALFTIME_MINUTE

  // Reaching 45' with no second half: stop and open the break.
  useEffect(() => {
    if (!sim && !atBreak && minute >= HALFTIME_MINUTE) setAtBreak(true)
  }, [sim, atBreak, minute])

  // The second half arrives (change confirmed or declined): play on from 45'.
  useEffect(() => {
    if (sim && atBreak) {
      setAtBreak(false)
      setPlaying(true)
    }
  }, [sim, atBreak])

  useEffect(() => {
    if (!playing || finished || atBreak) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setMinute((m) => Math.min(cap, m + dt * MINUTES_PER_SECOND * speed))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, finished, atBreak, cap])

  // Linger on the final whistle, then move on — unless a shootout takes over.
  useEffect(() => {
    if (!finished || showShootout) return
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [finished, showShootout, onDone])

  const visibleEvents = useMemo(
    () => events.filter((event) => event.minute <= minute),
    [events, minute],
  )
  const goals = useMemo(() => events.filter((e) => e.type === 'goal'), [events])
  const visibleGoals = useMemo(() => goals.filter((g) => g.minute <= minute), [goals, minute])

  const score = visibleGoals.reduce(
    (acc, goal) => ({
      home: acc.home + (goal.side === 'home' ? 1 : 0),
      away: acc.away + (goal.side === 'away' ? 1 : 0),
    }),
    { home: 0, away: 0 },
  )

  // Celebrate each goal exactly once as the playhead crosses it.
  useEffect(() => {
    if (visibleGoals.length > celebratedCount.current) {
      celebratedCount.current = visibleGoals.length
      setCelebration(visibleGoals[visibleGoals.length - 1])
    } else if (visibleGoals.length < celebratedCount.current) {
      // Scrubbed backwards: allow re-celebration from here.
      celebratedCount.current = visibleGoals.length
    }
  }, [visibleGoals])

  // Dismissal lives in its own effect keyed on the celebration: visibleGoals
  // gets a fresh identity every playhead frame, so a timer owned by the effect
  // above is cleared on the very next frame and never fires.
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(() => setCelebration(null), 2100)
    return () => clearTimeout(timer)
  }, [celebration])

  const shotsFor = (side: 'home' | 'away') =>
    visibleEvents.filter(
      (e) => e.side === side && (e.type === 'goal' || e.type === 'shot-saved' || e.type === 'shot-miss'),
    ).length
  const xgNow = xgTimeline[Math.min(Math.floor(minute), xgTimeline.length) - 1] ?? { home: 0, away: 0 }
  const latestRed = [...visibleEvents].reverse().find((e) => e.type === 'red-card')
  const inExtraTime = minute > 90

  const clockLabel = finished
    ? sim?.shootout
      ? 'PENALTIES'
      : sim?.wentToExtraTime
        ? 'AFTER EXTRA TIME'
        : 'FULL TIME'
    : atBreak
      ? 'HALF-TIME'
      : `${Math.floor(minute)}'${inExtraTime ? ' ET' : ''}`

  return (
    <div className="mx-auto max-w-5xl">
      {/* Scoreboard */}
      <div className="mb-5 rounded-2xl border border-white/10 bg-night-2/70 px-6 py-5">
        <div className="flex items-center justify-center gap-5 sm:gap-8">
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right font-display text-lg font-black uppercase tracking-widest sm:gap-3 sm:text-3xl" style={{ color: home.color }}>
            <span className="truncate">{home.name}</span>
            <TeamFlag teamId={home.id} className="h-4 shrink-0 sm:h-6" title="" />
          </span>
          <span className="font-display text-5xl font-black tabular-nums text-floodlight sm:text-7xl">
            <AnimatedDigit value={score.home} color={home.color} />
            <span className="mx-1 text-muted">–</span>
            <AnimatedDigit value={score.away} color={away.color} />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left font-display text-lg font-black uppercase tracking-widest sm:gap-3 sm:text-3xl" style={{ color: away.color }}>
            <TeamFlag teamId={away.id} className="h-4 shrink-0 sm:h-6" title="" />
            <span className="truncate">{away.name}</span>
          </span>
        </div>
        <div className="mt-2 text-center font-display text-lg font-black tabular-nums text-card-yellow">
          {clockLabel}
        </div>

        {/* Timeline scrubber */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={atBreak}
            className={`w-9 rounded-md border border-white/15 py-1.5 text-sm text-floodlight transition-colors hover:border-white/40 disabled:opacity-40 ${FOCUS_RING}`}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing && !finished ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={cap}
            step={0.5}
            value={minute}
            disabled={atBreak}
            onChange={(e) => setMinute(Number(e.target.value))}
            className={`h-1.5 min-w-40 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-card-yellow disabled:opacity-40 ${FOCUS_RING}`}
            aria-label="Match minute"
          />
          <button
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className={`w-12 rounded-md border border-white/15 py-1.5 text-sm font-bold tabular-nums text-floodlight transition-colors hover:border-white/40 ${FOCUS_RING}`}
            aria-label="Playback speed"
          >
            {speed}×
          </button>
          {!atBreak && (
            <button
              onClick={onDone}
              disabled={resuming}
              className={`rounded-md border border-white/15 px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-white/40 hover:text-floodlight disabled:opacity-40 ${FOCUS_RING}`}
            >
              Skip to result ▸
            </button>
          )}
        </div>

        {/* Live counters */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] font-bold uppercase tracking-widest text-muted sm:gap-x-8">
          <span className="whitespace-nowrap">
            Shots <span className="text-floodlight tabular-nums">{shotsFor('home')}–{shotsFor('away')}</span>
          </span>
          <span className="whitespace-nowrap">
            xG <span className="text-floodlight tabular-nums">{xgNow.home.toFixed(2)}–{xgNow.away.toFixed(2)}</span>
          </span>
          {latestRed && (
            <span className="whitespace-nowrap text-card-red">
              🟥 {latestRed.player?.name} ({latestRed.teamId})
            </span>
          )}
        </div>
      </div>

      {showShootout && sim?.shootout ? (
        <PenaltyShootout shootout={sim.shootout} home={home} away={away} onDone={onDone} />
      ) : atBreak ? (
        <HalftimeBreak
          match={match}
          firstHalf={firstHalf}
          lineups={lineups}
          home={home}
          away={away}
          resuming={resuming}
          onResume={onResume}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-night-2/70 p-5">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">
              The xG race
            </h2>
            <XgRaceChart
              timeline={xgTimeline}
              minute={minute}
              goals={goals}
              homeName={home.shortName}
              awayName={away.shortName}
              homeColor={home.chartColor}
              awayColor={away.chartColor}
              maxMinute={duration}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-night-2/70 p-5">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">
              Live commentary
            </h2>
            <div className="scroll-area flex h-[19rem] flex-col gap-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {/* visibleEvents is a growing prefix of the events array, so the index is a stable key. */}
                {visibleEvents
                  .map((event, index) => (
                    <EventCard key={index} event={event} homeShort={home.shortName} awayShort={away.shortName} />
                  ))
                  .reverse()}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>{celebration && <GoalCelebration event={celebration} />}</AnimatePresence>

      {/* Red card flash */}
      <AnimatePresence>
        {latestRed && minute - latestRed.minute < 1.2 && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-40"
            style={{ background: 'radial-gradient(80% 80% at 50% 50%, rgba(229,72,77,0.25), transparent 70%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
