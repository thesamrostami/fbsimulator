import { useEffect, useState } from 'react'
import type { TeamInfo } from '../../data/teams'
import type { SimResult } from '../../engine/types'
import { FOCUS_RING } from '../../ui/theme'
import { MatchStage } from './MatchStage'

/** Replay pace: match-minutes per real second at 1×. 90' in 30s. */
const MIN_PER_SECOND = 3
const SPEEDS = [1, 2, 4] as const

interface TerrainReplayProps {
  sim: SimResult
  home: TeamInfo
  away: TeamInfo
}

/**
 * A self-contained replay of the finished match on the 3D stage: its own
 * playhead (not the match screen's), so on the result page you can watch the
 * whole game again, scrub it, or replay it — only what happened.
 */
export function TerrainReplay({ sim, home, away }: TerrainReplayProps) {
  const duration = sim.wentToExtraTime ? 120 : 90
  const [minute, setMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)

  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const finished = minute >= duration

  useEffect(() => {
    if (!playing || finished) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setMinute((m) => Math.min(duration, m + dt * MIN_PER_SECOND * speed))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, finished, duration])

  const restart = () => {
    setMinute(0)
    setPlaying(true)
  }
  const togglePlay = () => {
    if (finished) restart()
    else setPlaying((p) => !p)
  }

  return (
    <div>
      <MatchStage
        sequences={sim.sequences}
        events={sim.events}
        lineupLog={sim.lineupLog}
        momentumTimeline={sim.momentumTimeline}
        minute={minute}
        duration={duration}
        home={home}
        away={away}
        reducedMotion={reducedMotion}
        autoRotate={finished}
        title="Replay"
      />

      {/* Replay transport — independent of the match screen. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <button
          onClick={togglePlay}
          aria-label={finished ? 'Replay' : playing ? 'Pause' : 'Play'}
          className={`w-9 rounded-md border border-ink/15 py-1.5 text-sm text-floodlight transition-colors hover:border-ink/40 ${FOCUS_RING}`}
        >
          {finished ? '↻' : playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={minute}
          onChange={(e) => {
            setMinute(Number(e.target.value))
            setPlaying(false)
          }}
          className={`h-1.5 min-w-40 flex-1 cursor-pointer appearance-none rounded-full bg-ink/10 accent-card-yellow ${FOCUS_RING}`}
          aria-label="Replay minute"
        />
        <span className="w-12 text-right font-display text-sm font-black tabular-nums text-floodlight">
          {Math.floor(minute)}&#8242;
        </span>
        <button
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label="Replay speed"
          className={`w-12 rounded-md border border-ink/15 py-1.5 text-sm font-bold tabular-nums text-floodlight transition-colors hover:border-ink/40 ${FOCUS_RING}`}
        >
          {speed}×
        </button>
      </div>
    </div>
  )
}
