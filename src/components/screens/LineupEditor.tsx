import { LayoutGroup, motion } from 'framer-motion'
import { useCallback, useMemo, useState, type Dispatch, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { describeModifiers, FORMATIONS, formationOptions, formationSlots } from '../../data/formations'
import type { PlayedMatch } from '../../data/matches'
import { getPlayer } from '../../data/players'
import { SQUADS } from '../../data/squads'
import { TEAMS, tint } from '../../data/teams'
import { computeAnchoredStrength, computeSheetStrength } from '../../engine/ratings'
import { describeProfile, TACTIC_DIALS } from '../../engine/tactics'
import type { Line, Tactics } from '../../engine/types'
import {
  buildSheet,
  countPersonnelChanges,
  MAX_HALFTIME_SUBS,
  sameLocation,
  type ChipLocation,
  type LineupState,
  type MatchAppAction,
  type SideKey,
} from '../../state/appState'
import { PlayerCard } from '../pitch/PlayerCard'
import { Pitch } from '../pitch/Pitch'
import { ChipFace, PlayerChip } from '../pitch/PlayerChip'
import { RatingsBars } from '../pitch/RatingsBars'
import { SourceBadge } from '../ui/SourceBadge'
import { TeamFlag } from '../ui/TeamFlag'
import { BTN_SECONDARY, FOCUS_RING } from '../../ui/theme'
import { locationAttr, useChipDrag } from '../../ui/useChipDrag'
import { useScrollFade } from '../../ui/useScrollFade'

/** The three instruction dials. Neutral is what the real match is replayed with. */
function TacticsPanel({
  tactics,
  accent,
  onChange,
}: {
  tactics: Tactics
  accent: string
  onChange: (change: Partial<Tactics>) => void
}) {
  const chips = describeProfile(tactics)
  return (
    <div className="mb-3 rounded-xl border border-ink/10 bg-night-2/60 p-3" data-testid="tactics">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Instructions</span>
        <span className="truncate text-[11px] text-muted">
          {chips.length > 0 ? `${chips.length} effect${chips.length === 1 ? '' : 's'} in play` : 'as the real match was played'}
        </span>
      </div>
      <div className="space-y-2.5">
        {TACTIC_DIALS.map((dial) => {
          const current = tactics[dial.key]
          const option = dial.options.find((o) => o.value === current)
          return (
            <div key={dial.key}>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted">{dial.label}</span>
                <div role="radiogroup" aria-label={dial.label} className="flex min-w-0 flex-1 rounded-md border border-ink/10 bg-night/40 p-0.5">
                  {dial.options.map((o) => {
                    const active = o.value === current
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={o.blurb}
                        onClick={() => onChange({ [dial.key]: o.value } as Partial<Tactics>)}
                        className={`min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 font-display text-[11px] font-black tracking-wide transition-colors ${FOCUS_RING} ${
                          active ? 'text-floodlight' : 'text-muted hover:text-floodlight'
                        }`}
                        style={active ? { background: tint(accent, 0.16), boxShadow: `inset 0 -2px 0 ${accent}` } : undefined}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="ml-[4.5rem] mt-1 text-[10px] leading-snug text-muted">{option?.blurb}</p>
            </div>
          )
        })}
      </div>
      {chips.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Instruction effects">
          {chips.map((chip) => (
            <li key={chip} className="rounded border border-ink/10 bg-ink/5 px-1.5 py-0.5 text-[10px] tabular-nums text-floodlight/80">
              {chip}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface LineupEditorProps {
  match: PlayedMatch
  lineups: Record<SideKey, LineupState>
  dispatch: Dispatch<MatchAppAction>
  onKickOff: () => void
  simulating: boolean
  /** 'pause' (half-time or a substitution window) turns on substitution limits and sent-off filtering. */
  mode?: 'prematch' | 'pause' | 'halftime'
  /** Pause: the minute the match is frozen at (labels). */
  pauseMinute?: number
  /** Pause: the XIs on the pitch at the pause — the sub-count baseline. */
  firstHalfStarters?: Record<SideKey, Record<string, string>>
  /** Pause: substitutions already confirmed at earlier windows, per side. */
  subsUsedBefore?: Record<SideKey, number>
  /** Pause: players substituted off earlier — gone from the bench for good. */
  unavailable?: Record<SideKey, ReadonlySet<string>>
  /** Pause: players sent off; shown as holes on the pitch, nowhere selectable. */
  dismissed?: ReadonlySet<string>
  /** Pause: the "does this change help" strip, rendered in the side panel. */
  insight?: ReactNode
  /** Pause: extra controls under the buttons (the next-window toggle). */
  footer?: ReactNode
}

export function LineupEditor({
  match,
  lineups,
  dispatch,
  onKickOff,
  simulating,
  mode = 'prematch',
  pauseMinute = 45,
  firstHalfStarters,
  subsUsedBefore,
  unavailable,
  dismissed,
  insight,
  footer,
}: LineupEditorProps) {
  const [side, setSide] = useState<SideKey>('home')
  const [selected, setSelected] = useState<ChipLocation | null>(null)

  // Drag-and-drop (mouse/pen) on top of tap-to-swap: a drop is just a swap.
  const onDrop = useCallback(
    (from: ChipLocation, to: ChipLocation) => {
      dispatch({ type: 'swap', side, a: from, b: to })
      setSelected(null)
    },
    [dispatch, side],
  )
  const { drag, handlersFor, consumeClick } = useChipDrag(onDrop)

  const halftime = mode === 'halftime' || mode === 'pause'
  const usedBefore = subsUsedBefore?.[side] ?? 0
  const gone = unavailable?.[side]
  const sideDef = match[side]
  const team = TEAMS[sideDef.teamId]
  const lineup = lineups[side]
  const slots = useMemo(() => formationSlots(lineup.formation), [lineup.formation])
  const sheet = useMemo(() => buildSheet(sideDef, lineup), [sideDef, lineup])
  const strength = useMemo(() => {
    // At half-time a sent-off player will not play on: rate the XI without him.
    if (halftime && dismissed && dismissed.size > 0) {
      return computeAnchoredStrength(sheet, sheet.starters.filter((a) => !dismissed.has(a.player.id)))
    }
    return computeSheetStrength(sheet)
  }, [sheet, halftime, dismissed])
  const flagsByPlayer = useMemo(
    () => new Map(strength.flags.map((flag) => [flag.playerId, flag])),
    [strength],
  )

  const originalXI = useMemo(
    () => (halftime && firstHalfStarters ? new Set(Object.values(firstHalfStarters[side])) : null),
    [halftime, firstHalfStarters, side],
  )
  const subsUsed =
    halftime && firstHalfStarters
      ? usedBefore + countPersonnelChanges(firstHalfStarters[side], lineup.startersBySlot)
      : 0
  const subsMaxed = halftime && subsUsed >= MAX_HALFTIME_SUBS

  const handleChipTap = (location: ChipLocation) => {
    if (consumeClick()) return
    if (selected === null) {
      setSelected(location)
      return
    }
    if (sameLocation(selected, location)) {
      setSelected(null)
      return
    }
    dispatch({ type: 'swap', side, a: selected, b: location })
    setSelected(null)
  }

  const switchSide = (next: SideKey) => {
    setSide(next)
    setSelected(null)
  }

  const draggedPlayer = useMemo(() => {
    if (!drag) return null
    const from = drag.from
    const id = from.kind === 'slot' ? lineup.startersBySlot[from.slotId] : lineup.bench[from.index]
    if (!id) return null
    const player = getPlayer(id)
    const role = from.kind === 'slot' ? (slots.find((s) => s.id === from.slotId)?.label ?? '') : player.ratings.position
    return { player, role }
  }, [drag, lineup, slots])

  const selectedPlayer = useMemo(() => {
    if (!selected) return null
    const id =
      selected.kind === 'slot' ? lineup.startersBySlot[selected.slotId] : lineup.bench[selected.index]
    return id ? getPlayer(id) : null
  }, [selected, lineup])

  const formationScroll = useScrollFade<HTMLDivElement>('x', [sideDef.formation])

  const squad = SQUADS[sideDef.teamId]
  // Bench grouped by natural position; each chip keeps its flat bench index for swaps.
  const benchGroups = useMemo(() => {
    const lines: { line: Line; label: string }[] = [
      { line: 'GK', label: 'Goalkeepers' },
      { line: 'DEF', label: 'Defenders' },
      { line: 'MID', label: 'Midfielders' },
      { line: 'FWD', label: 'Forwards' },
    ]
    const entries = sheet.bench
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !(halftime && (dismissed?.has(player.id) || gone?.has(player.id))))
    return lines
      .map(({ line, label }) => ({
        line,
        label,
        entries: entries.filter(({ player }) => player.ratings.position === line),
      }))
      .filter((group) => group.entries.length > 0)
  }, [sheet.bench, halftime, dismissed, gone])

  const benchScroll = useScrollFade<HTMLDivElement>('y', [side, sheet.bench.length, benchGroups.length, gone])

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <LayoutGroup>
        <div>
          {/* Team toggle */}
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Edit team">
            {(['home', 'away'] as const).map((key) => {
              const keyTeam = TEAMS[match[key].teamId]
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={side === key}
                  onClick={() => switchSide(key)}
                  className={`relative min-w-0 flex-1 rounded-lg border px-2 py-2 font-display text-xs font-black uppercase tracking-widest transition-colors sm:px-4 sm:text-sm ${FOCUS_RING} ${
                    side === key
                      ? 'border-ink/25 text-floodlight'
                      : 'border-ink/10 text-muted hover:text-floodlight'
                  }`}
                >
                  {side === key && (
                    <motion.span
                      layoutId="team-tab"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: tint(keyTeam.color, 0.14), boxShadow: `inset 0 -2px 0 ${keyTeam.color}` }}
                    />
                  )}
                  <span className="relative inline-flex max-w-full items-center gap-1.5 sm:gap-2">
                    <TeamFlag teamId={keyTeam.id} className="h-3 shrink-0 sm:h-3.5" title="" />
                    <span className="truncate">{keyTeam.name}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Formation picker: real shape by default, seven alternatives to test. */}
          <div className="mb-3 rounded-xl border border-ink/10 bg-night-2/60 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Formation</span>
              <span className="truncate text-[11px] text-muted">{describeModifiers(lineup.formation)}</span>
            </div>
            <div
              ref={formationScroll}
              className="scroll-area scroll-fade-x flex gap-1.5 overflow-x-auto pb-1"
              role="radiogroup"
              aria-label="Formation"
            >
              {formationOptions(sideDef.formation).map((name) => {
                const active = lineup.formation === name
                const isReal = name === sideDef.formation
                return (
                  <button
                    key={name}
                    role="radio"
                    aria-checked={active}
                    title={`${FORMATIONS[name].blurb} (${describeModifiers(name)})${isReal ? ' — the real shape that day' : ''}`}
                    onClick={() => {
                      dispatch({ type: 'formation', side, formation: name })
                      setSelected(null)
                    }}
                    className={`shrink-0 rounded-md border px-2.5 py-1.5 font-display text-xs font-black tracking-wider transition-colors ${FOCUS_RING} ${
                      active
                        ? 'border-ink/30 text-floodlight'
                        : 'border-ink/10 text-muted hover:border-ink/25 hover:text-floodlight'
                    }`}
                    style={active ? { background: tint(team.color, 0.14), boxShadow: `inset 0 -2px 0 ${team.color}` } : undefined}
                  >
                    {name}
                    {isReal && <span className="ml-1 align-middle text-[9px] font-bold text-mexico">●</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <TacticsPanel
            tactics={lineup.tactics}
            accent={team.color}
            onChange={(change) => {
              dispatch({ type: 'tactics', side, tactics: change })
              setSelected(null)
            }}
          />

          {/* Halftime: the real-football personnel cap, live. */}
          {halftime && (
            <div className="mb-3 rounded-xl border border-ink/10 bg-night-2/60 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  Substitutions
                </span>
                <span
                  data-testid="subs-counter"
                  className={`font-display text-sm font-black tabular-nums ${
                    subsMaxed ? 'text-gold' : 'text-floodlight'
                  }`}
                >
                  {subsUsed} / {MAX_HALFTIME_SUBS}
                </span>
              </div>
              {subsMaxed && (
                <p className="mt-1 text-[11px] text-gold">
                  No substitutions left — formation and position changes are still allowed, and you
                  can undo a sub by bringing back a player who was on the pitch.
                </p>
              )}
            </div>
          )}

          {/* Provenance: lineups are real; ratings are FC 26 where matched, estimates otherwise. */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <SourceBadge kind="real" /> lineups &amp; bench
            </span>
            <span className="flex items-center gap-1.5">
              <SourceBadge kind="fc26" /> matched players
            </span>
            <span className="flex items-center gap-1.5">
              <SourceBadge kind="estimated" /> the rest
            </span>
          </div>

          <Pitch>
            {slots.map((slot) => {
              const assignment = sheet.starters.find((a) => a.slot.id === slot.id)
              if (!assignment) return null
              const location: ChipLocation = { kind: 'slot', slotId: slot.id }
              if (halftime && dismissed?.has(assignment.player.id)) {
                // Sent off: the slot is a permanent hole — visible, never tappable.
                return (
                  <div
                    key={assignment.player.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}
                  >
                    <div
                      className="flex w-16 flex-col items-center rounded-xl border border-card-red/40 bg-card-red/10 px-1 pb-1 pt-1.5 opacity-80"
                      title={`${assignment.player.name} was sent off — plays no further part`}
                    >
                      <span className="font-display text-lg font-black leading-none text-card-red">▮</span>
                      <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold leading-tight text-floodlight/70">
                        {assignment.player.name}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-card-red">
                        Sent off
                      </span>
                    </div>
                  </div>
                )
              }
              return (
                // Keyed by PLAYER, not slot: a swap must unmount/remount the chip so its
                // layoutId re-registers — mutating layoutId on a mounted motion component
                // leaves a stale duplicate projection that freezes the visual update.
                <div
                  key={assignment.player.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}
                >
                  <PlayerChip
                    player={assignment.player}
                    roleLabel={slot.label}
                    accent={team.color}
                    selected={selected !== null && sameLocation(selected, location)}
                    flag={flagsByPlayer.get(assignment.player.id)}
                    onClick={() => handleChipTap(location)}
                    drag={handlersFor(location)}
                    location={locationAttr(location)}
                    dragging={drag !== null && sameLocation(drag.from, location)}
                    dropTarget={drag?.over !== null && drag?.over !== undefined && sameLocation(drag.over, location)}
                  />
                </div>
              )
            })}
          </Pitch>

          {/* Bench: the full non-starting squad, grouped by position */}
          <div data-testid="bench" className="mt-4 rounded-xl border border-ink/10 bg-night-2/60 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                Squad ({sheet.bench.length}) — tap to swap with a starter
              </span>
            </div>
            {!squad?.verified && (
              <p className="mb-2 rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] font-semibold text-gold">
                Partial bench — full squad unverified. Only players who featured in the real match are shown.
              </p>
            )}
            <div ref={benchScroll} className="scroll-area scroll-fade-y max-h-72 space-y-3 overflow-y-auto pr-1">
              {benchGroups.map((group) => (
                <div key={group.line}>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {group.entries.map(({ player, index }) => {
                      const location: ChipLocation = { kind: 'bench', index }
                      // At the cap, only first-half starters can still come off the
                      // bench (that undoes a sub); fresh legs are locked out.
                      const locked = subsMaxed && originalXI !== null && !originalXI.has(player.id)
                      return (
                        <PlayerChip
                          key={player.id}
                          player={player}
                          roleLabel={player.ratings.position}
                          accent={team.color}
                          selected={selected !== null && sameLocation(selected, location)}
                          disabled={locked}
                          onClick={() => handleChipTap(location)}
                          drag={handlersFor(location, !locked)}
                          location={locationAttr(location)}
                          dragging={drag !== null && sameLocation(drag.from, location)}
                          dropTarget={drag?.over !== null && drag?.over !== undefined && sameLocation(drag.over, location)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-ink/10 bg-night-2/60 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-black uppercase tracking-widest text-floodlight">
              <TeamFlag teamId={team.id} className="h-4" title="" /> {team.name} — live ratings
              <span className="ml-auto flex gap-1">
                <SourceBadge kind="fc26" short />
                <SourceBadge kind="estimated" short />
              </span>
            </h2>
            <RatingsBars strength={strength} accent={team.color} />
          </div>

          {selectedPlayer && <PlayerCard player={selectedPlayer} accent={team.color} />}

          {strength.flags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gold/40 bg-gold/10 p-4"
            >
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gold">
                Out of position
              </h3>
              <ul className="space-y-1 text-sm text-floodlight">
                {strength.flags.map((flag) => (
                  <li key={`${flag.playerId}-${flag.slotId}`}>
                    <span className="font-semibold">{flag.playerName}</span>
                    <span className="text-muted">
                      {' '}
                      — {flag.naturalLine} playing {flag.slotLabel}, ratings ×
                      {flag.penalty.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {insight}

          <div className="rounded-xl border border-ink/10 bg-night-2/60 p-5 text-sm leading-relaxed text-muted">
            Tap a player to see his full ratings and pick him up, then tap where
            he should go — another shirt to swap positions, or a bench player to
            substitute him in. With a mouse you can also drag one shirt onto
            another. Out-of-position players play worse: the further from home,
            the bigger the penalty. Instructions change how possessions unfold —
            they never change a player's ratings.
          </div>

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                dispatch({ type: 'reset', side, sideDef })
                setSelected(null)
              }}
              className={`px-5 py-3 ${BTN_SECONDARY}`}
            >
              {halftime ? (pauseMinute === 45 ? 'Reset to first-half XI' : 'Reset to the XI on the pitch') : 'Reset to real lineup'}
            </button>
            <motion.button
              onClick={onKickOff}
              disabled={simulating}
              whileHover={simulating ? undefined : { scale: 1.02 }}
              whileTap={simulating ? undefined : { scale: 0.97 }}
              className={`flex-1 rounded-lg px-6 py-3 font-display text-base font-black uppercase tracking-widest text-night disabled:opacity-70 ${FOCUS_RING}`}
              style={{
                background: `linear-gradient(100deg, ${TEAMS[match.home.teamId].color}, ${TEAMS[match.away.teamId].color})`,
              }}
            >
              {halftime
                ? simulating
                  ? 'Heading back out…'
                  : pauseMinute === 45
                    ? 'Play the second half ▸'
                    : 'Play on ▸'
                : simulating
                  ? 'Kicking off…'
                  : 'Kick off ▸'}
            </motion.button>
          </div>
          {footer}
        </div>
      </LayoutGroup>

      {/* The drag ghost: a copy of the chip that follows the pointer above everything. */}
      {drag &&
        draggedPlayer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-50 flex w-16 flex-col items-center rounded-xl border border-floodlight bg-night-2/95 px-1 pb-1 pt-1.5 shadow-2xl shadow-shade/60"
            style={{
              left: drag.x,
              top: drag.y,
              transform: 'translate(-50%, -50%) scale(1.08) rotate(-2deg)',
              boxShadow: `0 0 0 2px ${team.color}, 0 12px 30px ${tint(team.color, 0.35)}`,
            }}
          >
            <ChipFace player={draggedPlayer.player} roleLabel={draggedPlayer.role} accent={team.color} />
          </div>,
          document.body,
        )}
    </div>
  )
}
