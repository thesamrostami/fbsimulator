import { motion } from 'framer-motion'
import type { TeamStrength } from '../../engine/types'

interface RatingsBarsProps {
  strength: TeamStrength
  accent: string
}

const ROWS: { key: 'attack' | 'midfield' | 'defence'; label: string }[] = [
  { key: 'attack', label: 'ATT' },
  { key: 'midfield', label: 'MID' },
  { key: 'defence', label: 'DEF' },
]

/** Live team phase ratings; bar widths spring whenever the lineup changes. */
export function RatingsBars({ strength, accent }: RatingsBarsProps) {
  return (
    <div className="space-y-2.5">
      {ROWS.map(({ key, label }) => {
        const value = strength[key]
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-9 text-[11px] font-bold tracking-widest text-muted">{label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-white/5">
              <motion.div
                className="h-full"
                style={{ background: accent, borderRadius: '0 4px 4px 0' }}
                initial={false}
                animate={{ width: `${Math.min(value, 99)}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 24 }}
              />
            </div>
            <motion.span
              key={`${key}-${Math.round(value)}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-7 text-right font-display text-sm font-black tabular-nums text-floodlight"
            >
              {Math.round(value)}
            </motion.span>
          </div>
        )
      })}
    </div>
  )
}
