import { motion } from 'framer-motion'
import { isTeamId, TEAMS } from '../../data/teams'
import type { MatchEvent } from '../../engine/types'

const FALLBACK = { color: '#eef5f0' }

/** Full-screen burst when a goal crosses the playhead. Mounted inside AnimatePresence. */
export function GoalCelebration({ event }: { event: MatchEvent }) {
  const team = isTeamId(event.teamId) ? TEAMS[event.teamId] : FALLBACK
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 60% at 50% 50%, ${team.color}40, transparent 70%)`,
        }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1.15, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {[0, 1].map((ring) => (
        <motion.div
          key={ring}
          className="absolute rounded-full border-2"
          style={{ borderColor: team.color, width: 160, height: 160 }}
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 3.2 + ring, opacity: 0 }}
          transition={{ duration: 1.1, delay: ring * 0.18, ease: 'easeOut' }}
        />
      ))}
      <div className="relative text-center">
        <motion.div
          initial={{ scale: 0.3, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="font-display text-7xl font-black uppercase italic tracking-tight text-floodlight sm:text-8xl"
          style={{ textShadow: `0 0 42px ${team.color}` }}
        >
          Goal!
        </motion.div>
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.22, type: 'spring', stiffness: 300, damping: 22 }}
          className="mt-2 text-xl font-bold text-floodlight sm:text-2xl"
        >
          <span style={{ color: team.color }}>{event.player?.name}</span>
          <span className="text-muted"> · {event.minute}&#8242; · </span>
          {event.score.home}–{event.score.away}
        </motion.div>
      </div>
    </motion.div>
  )
}
