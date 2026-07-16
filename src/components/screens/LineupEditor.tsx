import { LayoutGroup, motion } from 'framer-motion'
import { useMemo, useState, type Dispatch } from 'react'
import { describeModifiers, FORMATIONS, formationOptions, formationSlots } from '../../data/formations'
import type { PlayedMatch } from '../../data/matches'
import { getPlayer } from '../../data/players'
import { SQUADS } from '../../data/squads'
import { TEAMS } from '../../data/teams'
import { computeSheetStrength } from '../../engine/ratings'
import type { Line } from '../../engine/types'
import {
  buildSheet,
  sameLocation,
  type ChipLocation,
  type MatchAppAction,
  type MatchAppState,
  type SideKey,
} from '../../state/appState'
import { PlayerCard } from '../pitch/PlayerCard'
import { Pitch } from '../pitch/Pitch'
import { PlayerChip } from '../pitch/PlayerChip'
import { RatingsBars } from '../pitch/RatingsBars'
import { SourceBadge } from '../ui/SourceBadge'
import { TeamFlag } from '../ui/TeamFlag'
import { BTN_SECONDARY, FOCUS_RING } from '../../ui/theme'

interface LineupEditorProps {
  match: PlayedMatch
  state: MatchAppState
  dispatch: Dispatch<MatchAppAction>
  onKickOff: () => void
  simulating: boolean
}

export function LineupEditor({ match, state, dispatch, onKickOff, simulating }: LineupEditorProps) {
  const [side, setSide] = useState<SideKey>('home')
  const [selected, setSelected] = useState<ChipLocation | null>(null)

  const sideDef = match[side]
  const team = TEAMS[sideDef.teamId]
  const lineup = state.lineups[side]
  const slots = useMemo(() => formationSlots(lineup.formation), [lineup.formation])
  const sheet = useMemo(() => buildSheet(sideDef, lineup), [sideDef, lineup])
  const strength = useMemo(() => computeSheetStrength(sheet), [sheet])
  const flagsByPlayer = useMemo(
    () => new Map(strength.flags.map((flag) => [flag.playerId, flag])),
    [strength],
  )

  const handleChipTap = (location: ChipLocation) => {
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

  const selectedPlayer = useMemo(() => {
    if (!selected) return null
    const id =
      selected.kind === 'slot' ? lineup.startersBySlot[selected.slotId] : lineup.bench[selected.index]
    return id ? getPlayer(id) : null
  }, [selected, lineup])

  const squad = SQUADS[sideDef.teamId]
  // Bench grouped by natural position; each chip keeps its flat bench index for swaps.
  const benchGroups = useMemo(() => {
    const lines: { line: Line; label: string }[] = [
      { line: 'GK', label: 'Goalkeepers' },
      { line: 'DEF', label: 'Defenders' },
      { line: 'MID', label: 'Midfielders' },
      { line: 'FWD', label: 'Forwards' },
    ]
    const entries = sheet.bench.map((player, index) => ({ player, index }))
    return lines
      .map(({ line, label }) => ({
        line,
        label,
        entries: entries.filter(({ player }) => player.ratings.position === line),
      }))
      .filter((group) => group.entries.length > 0)
  }, [sheet.bench])

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
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
                      ? 'border-white/25 text-floodlight'
                      : 'border-white/10 text-muted hover:text-floodlight'
                  }`}
                >
                  {side === key && (
                    <motion.span
                      layoutId="team-tab"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: `${keyTeam.color}22`, boxShadow: `inset 0 -2px 0 ${keyTeam.color}` }}
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
          <div className="mb-3 rounded-xl border border-white/10 bg-night-2/60 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Formation</span>
              <span className="truncate text-[11px] text-muted">{describeModifiers(lineup.formation)}</span>
            </div>
            <div className="scroll-area flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Formation">
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
                        ? 'border-white/30 text-floodlight'
                        : 'border-white/10 text-muted hover:border-white/25 hover:text-floodlight'
                    }`}
                    style={active ? { background: `${team.color}22`, boxShadow: `inset 0 -2px 0 ${team.color}` } : undefined}
                  >
                    {name}
                    {isReal && <span className="ml-1 align-middle text-[9px] font-bold text-mexico">●</span>}
                  </button>
                )
              })}
            </div>
          </div>

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
                  />
                </div>
              )
            })}
          </Pitch>

          {/* Bench: the full non-starting squad, grouped by position */}
          <div data-testid="bench" className="mt-4 rounded-xl border border-white/10 bg-night-2/60 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                Squad ({sheet.bench.length}) — tap to swap with a starter
              </span>
            </div>
            {!squad?.verified && (
              <p className="mb-2 rounded-md border border-card-yellow/40 bg-card-yellow/10 px-2 py-1 text-[11px] font-semibold text-card-yellow">
                Partial bench — full squad unverified. Only players who featured in the real match are shown.
              </p>
            )}
            <div className="scroll-area max-h-72 space-y-3 overflow-y-auto pr-1">
              {benchGroups.map((group) => (
                <div key={group.line}>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {group.entries.map(({ player, index }) => {
                      const location: ChipLocation = { kind: 'bench', index }
                      return (
                        <PlayerChip
                          key={player.id}
                          player={player}
                          roleLabel={player.ratings.position}
                          accent={team.color}
                          selected={selected !== null && sameLocation(selected, location)}
                          onClick={() => handleChipTap(location)}
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
          <div className="rounded-xl border border-white/10 bg-night-2/60 p-5">
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
              className="rounded-xl border border-card-yellow/40 bg-card-yellow/10 p-4"
            >
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-card-yellow">
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

          <div className="rounded-xl border border-white/10 bg-night-2/60 p-5 text-sm leading-relaxed text-muted">
            Tap a player to see his full ratings and pick him up, then tap where
            he should go — another shirt to swap positions, or a bench player to
            substitute him in. Out-of-position players play worse: the further
            from home, the bigger the penalty.
          </div>

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                dispatch({ type: 'reset', side, sideDef })
                setSelected(null)
              }}
              className={`px-5 py-3 ${BTN_SECONDARY}`}
            >
              Reset to real lineup
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
              {simulating ? 'Simulating 1,000 worlds…' : 'Kick off ▸'}
            </motion.button>
          </div>
        </div>
      </LayoutGroup>
    </div>
  )
}
