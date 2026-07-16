import { motion } from 'framer-motion'
import { fc26Info, ratingSource } from '../../data/players'
import type { Player } from '../../engine/types'
import { SourceBadge } from '../ui/SourceBadge'

const ROWS: { key: keyof Omit<Player['ratings'], 'position'>; label: string }[] = [
  { key: 'pace', label: 'Pace' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'passing', label: 'Passing' },
  { key: 'defending', label: 'Defending' },
  { key: 'physical', label: 'Physical' },
]

/**
 * Full ratings for one player — the complete object the engine sees, so
 * nothing about a player is hidden from the user.
 */
export function PlayerCard({ player, accent }: { player: Player; accent: string }) {
  const source = ratingSource(player.id)
  const fc26 = fc26Info(player.id)
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-night-2/60 p-5"
    >
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-3xl font-black tabular-nums" style={{ color: accent }}>
          {player.shirtNumber}
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-black uppercase tracking-wide text-floodlight">
            {player.name}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted">
            Natural position: {player.ratings.position}
          </div>
        </div>
        <span className="ml-auto shrink-0">
          <SourceBadge kind={source === 'fc26' ? 'fc26' : 'estimated'} />
        </span>
      </div>
      <div className="space-y-2">
        {ROWS.map(({ key, label }) => {
          const value = player.ratings[key]
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-[11px] font-bold uppercase tracking-widest text-muted">{label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-white/5">
                <motion.div
                  className="h-full"
                  style={{ background: accent, borderRadius: '0 3px 3px 0' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(value, 99)}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                />
              </div>
              <span className="w-7 text-right font-display text-sm font-black tabular-nums text-floodlight">
                {value}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {source === 'fc26'
          ? `EA SPORTS FC 26 attributes (unofficial dataset) for ${fc26?.fc26Name ?? player.name}, overall ${fc26?.overall}. A video game's editorial view — not official match statistics.`
          : `Editorial estimate written for this app — no FC 26 match was found for ${player.name}. Not an official stat.`}
      </p>
    </motion.div>
  )
}
