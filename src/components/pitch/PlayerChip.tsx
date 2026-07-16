import { motion } from 'framer-motion'
import type { OutOfPositionFlag, Player } from '../../engine/types'
import { FOCUS_RING, SPRING } from '../../ui/theme'

interface PlayerChipProps {
  player: Player
  roleLabel: string
  accent: string
  selected: boolean
  flag?: OutOfPositionFlag
  onClick: () => void
}

/**
 * One tappable player. Keyed by player id with a shared layoutId so a swap
 * (pitch<->pitch or pitch<->bench) springs the chip to its new home.
 */
export function PlayerChip({ player, roleLabel, accent, selected, flag, onClick }: PlayerChipProps) {
  return (
    <motion.button
      layoutId={player.id}
      layout
      transition={SPRING}
      onClick={onClick}
      aria-pressed={selected}
      title={
        flag
          ? `${player.name} is a ${flag.naturalLine} playing ${flag.slotLabel} — ratings scaled to ${Math.round(flag.penalty * 100)}%`
          : `${player.name} (${player.ratings.position})`
      }
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.94 }}
      className={`relative flex w-16 flex-col items-center rounded-xl border px-1 pb-1 pt-1.5 shadow-lg shadow-black/50 backdrop-blur-sm transition-colors ${FOCUS_RING} ${
        selected
          ? 'border-floodlight bg-floodlight/15'
          : 'border-white/10 bg-night-2/90 hover:border-white/30'
      }`}
      style={selected ? { boxShadow: `0 0 0 2px ${accent}, 0 0 18px ${accent}66` } : undefined}
    >
      <span
        className="font-display text-lg font-black leading-none tabular-nums"
        style={{ color: accent }}
      >
        {player.shirtNumber}
      </span>
      <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold leading-tight text-floodlight">
        {player.name}
      </span>
      <span className="text-[8px] font-bold uppercase tracking-widest text-muted">{roleLabel}</span>
      {flag && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={SPRING}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-card-yellow text-[9px] font-black text-night"
          aria-label="Out of position"
        >
          !
        </motion.span>
      )}
    </motion.button>
  )
}
