import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { TeamInfo } from '../../data/teams'
import type { PenaltyKick, PenDirection, ShootoutResult } from '../../engine/types'
import { TeamFlag } from '../ui/TeamFlag'
import { BTN_SECONDARY, FOCUS_RING } from '../../ui/theme'

interface PenaltyShootoutProps {
  shootout: ShootoutResult
  home: TeamInfo
  away: TeamInfo
  onDone: () => void
}

/** Milliseconds between kicks. */
const KICK_INTERVAL = 1700

const BALL_X: Record<PenDirection, string> = { left: '18%', center: '50%', right: '82%' }
const DIVE_X: Record<PenDirection, number> = { left: -46, center: 0, right: 46 }

function kickLabel(kick: PenaltyKick): string {
  if (kick.scored) return 'GOAL!'
  return kick.saved ? 'SAVED!' : 'OFF TARGET!'
}

function TallyRow({ team, kicks, score, active }: { team: TeamInfo; kicks: PenaltyKick[]; score: number; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active ? 'bg-ink/5' : ''}`}>
      <span className="flex w-24 items-center gap-2 truncate text-sm font-bold text-floodlight sm:w-32">
        <TeamFlag teamId={team.id} className="h-3.5 shrink-0" title="" /> {team.shortName}
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {kicks.map((kick, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
              kick.scored ? 'bg-mexico text-night' : 'bg-card-red/80 text-floodlight'
            }`}
            title={`${kick.player.name} — ${Math.round(kick.chance * 100)}% conversion odds — ${
              kick.scored ? 'scored' : kick.saved ? 'saved' : 'off target'
            }`}
          >
            {kick.scored ? '✓' : '✕'}
          </motion.span>
        ))}
      </div>
      <span className="font-display text-2xl font-black tabular-nums text-floodlight">{score}</span>
    </div>
  )
}

/**
 * Animated shootout: kicks alternate, the ball flies left/center/right, the
 * keeper dives, and the tally builds until a winner emerges.
 */
export function PenaltyShootout({ shootout, home, away, onDone }: PenaltyShootoutProps) {
  const [revealed, setRevealed] = useState(0)
  const finished = revealed >= shootout.kicks.length

  useEffect(() => {
    if (finished) return
    const timer = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 900 : KICK_INTERVAL)
    return () => clearTimeout(timer)
  }, [revealed, finished])

  const current: PenaltyKick | undefined = revealed > 0 ? shootout.kicks[revealed - 1] : undefined
  const visible = useMemo(() => shootout.kicks.slice(0, revealed), [shootout.kicks, revealed])
  const homeKicks = visible.filter((k) => k.side === 'home')
  const awayKicks = visible.filter((k) => k.side === 'away')
  const score = current?.scoreAfter ?? { home: 0, away: 0 }
  const winner = shootout.winner === 'home' ? home : away
  const kicker = current && (current.side === 'home' ? home : away)
  const nextKick = !finished ? shootout.kicks[revealed] : undefined
  const nextTeam = nextKick && (nextKick.side === 'home' ? home : away)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl rounded-2xl border border-ink/10 bg-night-2/80 p-6"
    >
      <h2 className="mb-1 text-center font-display text-2xl font-black uppercase tracking-widest text-gold">
        Penalty shootout
      </h2>
      <p className="mb-4 text-center text-xs text-muted">
        {finished
          ? `${winner.name} win it ${shootout.score.home}–${shootout.score.away}`
          : nextTeam
            ? `${nextTeam.name} to kick…`
            : ''}
      </p>

      {/* The goal */}
      <div className="relative mx-auto mb-5 h-40 max-w-md overflow-hidden rounded-xl border border-ink/10 bg-pitch">
        {/* goal frame */}
        <div className="absolute left-[8%] right-[8%] top-5 h-24 rounded-sm border-2 border-floodlight/70 border-b-0 bg-ink/[0.03]" />
        {/* net hint */}
        <div
          className="absolute left-[8%] right-[8%] top-5 h-24 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0 7px, color-mix(in srgb, var(--color-ink) 50%, transparent) 7px 8px), repeating-linear-gradient(90deg, transparent 0 7px, color-mix(in srgb, var(--color-ink) 50%, transparent) 7px 8px)',
          }}
        />
        {/* keeper */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`keeper-${revealed}`}
            className="absolute left-1/2 top-16 -ml-4 text-3xl"
            initial={{ x: 0, rotate: 0 }}
            animate={
              current
                ? { x: DIVE_X[current.dive], rotate: current.dive === 'left' ? -40 : current.dive === 'right' ? 40 : 0 }
                : { x: 0 }
            }
            transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 18 }}
            aria-hidden="true"
          >
            🧤
          </motion.div>
        </AnimatePresence>
        {/* ball */}
        <AnimatePresence mode="popLayout">
          {current && (
            <motion.div
              key={`ball-${revealed}`}
              className="absolute bottom-2 text-2xl"
              style={{ left: '50%', marginLeft: -12 }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: `calc(${BALL_X[current.direction]} - 50%)`,
                y: current.scored || current.saved ? -78 : -128,
                opacity: current.scored ? 1 : 0.55,
                scale: 0.8,
              }}
              transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
              aria-hidden="true"
            >
              ⚽
            </motion.div>
          )}
        </AnimatePresence>
        {/* outcome flash */}
        <AnimatePresence mode="popLayout">
          {current && (
            <motion.div
              key={`label-${revealed}`}
              className="absolute inset-x-0 bottom-3 text-center font-display text-xl font-black uppercase tracking-widest"
              style={{ color: current.scored ? kicker?.color : 'var(--color-card-red)' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.75, type: 'spring', stiffness: 300, damping: 20 }}
            >
              {kickLabel(current)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Kicker line */}
      <div className="mb-4 h-5 text-center text-sm text-floodlight/85">
        {current && kicker && (
          <motion.span key={revealed} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1.5">
            <TeamFlag teamId={kicker.id} className="h-3.5" title="" />{' '}
            <span className="font-semibold" style={{ color: kicker.color }}>
              {current.player.name}
            </span>{' '}
            steps up… <span className="text-muted">({Math.round(current.chance * 100)}% odds)</span>
          </motion.span>
        )}
      </div>

      {/* Running tally */}
      <div className="space-y-2">
        <TallyRow team={home} kicks={homeKicks} score={score.home} active={!finished && nextKick?.side === 'home'} />
        <TallyRow team={away} kicks={awayKicks} score={score.away} active={!finished && nextKick?.side === 'away'} />
      </div>

      <div className="mt-5 flex justify-center gap-3">
        {!finished && (
          <button onClick={() => setRevealed(shootout.kicks.length)} className={`px-4 py-2 ${BTN_SECONDARY}`}>
            Skip ▸
          </button>
        )}
        {finished && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onDone}
            className={`rounded-lg px-6 py-3 font-display text-sm font-black uppercase tracking-widest text-night ${FOCUS_RING}`}
            style={{ background: winner.color }}
          >
            {winner.name} go through — see the result ▸
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
