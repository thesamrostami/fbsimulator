import { motion } from 'framer-motion'
import type { OutOfPositionFlag, Player } from '../../engine/types'
import { tint } from '../../data/teams'
import { FOCUS_RING, SPRING } from '../../ui/theme'
import type { ChipDragHandlers } from '../../ui/useChipDrag'

interface PlayerChipProps {
  player: Player
  roleLabel: string
  accent: string
  selected: boolean
  flag?: OutOfPositionFlag
  /** Not currently swappable (e.g. the half-time substitution cap is reached). */
  disabled?: boolean
  onClick: () => void
  /** Pointer drag-and-drop wiring from useChipDrag (mouse/pen). */
  drag?: ChipDragHandlers
  /** `data-location` value so a drop can find this chip under the pointer. */
  location?: string
  /** This chip is the one being dragged (drawn faded; the ghost follows the pointer). */
  dragging?: boolean
  /** The dragged chip is hovering here: highlight as the drop target. */
  dropTarget?: boolean
}

/** The chip's face, shared with the drag ghost. */
export function ChipFace({ player, roleLabel, accent }: { player: Player; roleLabel: string; accent: string }) {
  return (
    <>
      <span className="font-display text-lg font-black leading-none tabular-nums" style={{ color: accent }}>
        {player.shirtNumber}
      </span>
      <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold leading-tight text-floodlight">
        {player.name}
      </span>
      <span className="text-[8px] font-bold uppercase tracking-widest text-muted">{roleLabel}</span>
    </>
  )
}

/**
 * One tappable (and draggable) player. Keyed by player id with a shared
 * layoutId so a swap (pitch<->pitch or pitch<->bench) springs the chip to
 * its new home.
 */
export function PlayerChip({
  player,
  roleLabel,
  accent,
  selected,
  flag,
  disabled,
  onClick,
  drag,
  location,
  dragging,
  dropTarget,
}: PlayerChipProps) {
  const highlight = selected || dropTarget
  return (
    <motion.button
      layoutId={player.id}
      layout
      transition={SPRING}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-location={location}
      title={
        disabled
          ? `${player.name} — no substitutions left`
          : flag
            ? `${player.name} is a ${flag.naturalLine} playing ${flag.slotLabel} — ratings scaled to ${Math.round(flag.penalty * 100)}%`
            : `${player.name} (${player.ratings.position}) — tap to pick up, or drag onto another player`
      }
      whileHover={disabled || dragging ? undefined : { scale: 1.07 }}
      whileTap={disabled || dragging ? undefined : { scale: 0.94 }}
      {...(disabled ? {} : drag)}
      className={`relative flex w-16 flex-col items-center rounded-xl border px-1 pb-1 pt-1.5 shadow-lg shadow-shade/50 backdrop-blur-sm transition-colors ${FOCUS_RING} ${
        highlight
          ? 'border-floodlight bg-floodlight/15'
          : disabled
            ? 'cursor-not-allowed border-ink/5 bg-night-2/60 opacity-40'
            : 'cursor-grab border-ink/10 bg-night-2/90 hover:border-ink/30 active:cursor-grabbing'
      } ${dragging ? 'opacity-35' : ''}`}
      style={{
        touchAction: 'manipulation',
        ...(highlight ? { boxShadow: `0 0 0 2px ${accent}, 0 0 18px ${tint(accent, 0.4)}` } : {}),
      }}
    >
      <ChipFace player={player} roleLabel={roleLabel} accent={accent} />
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
