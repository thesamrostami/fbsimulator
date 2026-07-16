import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { isTeamId, TEAMS } from '../../data/teams'
import type { MatchEvent, MatchEventType } from '../../engine/types'

const ICONS: Record<MatchEventType, string> = {
  kickoff: '📣',
  goal: '⚽',
  'shot-saved': '🧤',
  'shot-miss': '💨',
  'yellow-card': '🟨',
  'red-card': '🟥',
  momentum: '⚡',
  'sub-window': '🔁',
  'extra-time': '⏳',
  penalties: '🎯',
  'full-time': '⏱️',
}

const MAJOR: ReadonlySet<MatchEventType> = new Set(['goal', 'red-card', 'extra-time', 'penalties', 'full-time'])

interface EventCardProps {
  event: MatchEvent
  homeShort: string
  awayShort: string
}

export function EventCard({ event, homeShort, awayShort }: EventCardProps) {
  const [expanded, setExpanded] = useState(false)
  const team = isTeamId(event.teamId) ? TEAMS[event.teamId] : undefined
  const major = MAJOR.has(event.type)
  const expandable = Boolean(event.reasoning)

  const body = (
    <>
      <span className="w-9 shrink-0 pt-0.5 text-right font-display text-sm font-black tabular-nums text-muted">
        {event.minute}&#8242;
      </span>
      <span className="shrink-0 text-base leading-6" aria-hidden="true">
        {ICONS[event.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${major ? 'font-semibold text-floodlight' : 'text-floodlight/80'}`}>
          {event.commentary}
        </p>
        {event.type === 'goal' && (
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-muted">
            {homeShort} {event.score.home} – {event.score.away} {awayShort}
            {typeof event.xg === 'number' && ` · chance xG ${event.xg.toFixed(2)}`}
          </p>
        )}
        <AnimatePresence initial={false}>
          {expanded && event.reasoning && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1.5 overflow-hidden border-t border-white/10 pt-1.5 text-xs leading-relaxed text-muted"
            >
              {event.reasoning}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {expandable && (
        <span
          aria-hidden="true"
          className={`shrink-0 pt-1 text-[10px] text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      )}
    </>
  )

  const shared = `flex items-start gap-3 rounded-lg border bg-night-2/80 px-3 py-2.5 ${
    major ? 'border-white/25' : 'border-white/10'
  }`
  const style = team ? { borderLeft: `3px solid ${team.color}` } : undefined
  const motionProps = {
    layout: true,
    initial: { opacity: 0, x: 48, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -24 },
    transition: { type: 'spring', stiffness: 320, damping: 28 },
  } as const

  if (!expandable) {
    return (
      <motion.div {...motionProps} className={shared} style={style}>
        {body}
      </motion.div>
    )
  }

  return (
    <motion.button
      {...motionProps}
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      title={expanded ? 'Hide the numbers behind this event' : 'Show the numbers behind this event'}
      className={`${shared} w-full cursor-pointer text-left transition-colors hover:border-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-card-yellow/70`}
      style={style}
    >
      {body}
    </motion.button>
  )
}
