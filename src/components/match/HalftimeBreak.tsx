import { motion } from 'framer-motion'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { formationSlots } from '../../data/formations'
import type { PlayedMatch } from '../../data/matches'
import type { TeamId, TeamInfo } from '../../data/teams'
import { sentOffIds, type HalftimeState } from '../../engine/simulate'
import { runHalftimeInsight, type HalftimeInsightRuns } from '../../services/simulation'
import { buildHalftimeShifts } from '../../services/whyThisResult'
import {
  buildSheet,
  makeHalftimeReducer,
  type LineupState,
  type SideKey,
} from '../../state/appState'
import { BTN_SECONDARY, CARD, FOCUS_RING, PANEL } from '../../ui/theme'
import { CompareRow } from '../result/InsightPanel'
import { LineupEditor } from '../screens/LineupEditor'
import { TeamFlag } from '../ui/TeamFlag'

interface HalftimeBreakProps {
  match: PlayedMatch
  /** The live match frozen at 45'. Read-only here; the parent resumes it. */
  firstHalf: HalftimeState
  /** The lineups that started the match — the editor's baseline and sub-count anchor. */
  lineups: Record<SideKey, LineupState>
  home: TeamInfo
  away: TeamInfo
  resuming: boolean
  onResume: (lineups: Record<SideKey, LineupState>, edited: boolean) => void
}

/**
 * The 45' whistle: score and cards so far, then either straight back out or
 * into the lineup editor (half-time rules: max 5 subs, sent-off players gone)
 * with a second-half-only Monte Carlo verdict on any change before it's
 * confirmed.
 */
export function HalftimeBreak({ match, firstHalf, lineups, home, away, resuming, onResume }: HalftimeBreakProps) {
  const [editing, setEditing] = useState(false)
  const reducer = useMemo(() => makeHalftimeReducer(lineups), [lineups])
  const [htLineups, dispatch] = useReducer(reducer, lineups)
  const dismissed = useMemo(() => sentOffIds(firstHalf), [firstHalf])

  const edited = useMemo(
    () =>
      (['home', 'away'] as const).some((side) => {
        if (htLineups[side].formation !== lineups[side].formation) return true
        return formationSlots(lineups[side].formation).some(
          (slot) => htLineups[side].startersBySlot[slot.id] !== lineups[side].startersBySlot[slot.id],
        )
      }),
    [htLineups, lineups],
  )

  // The verdict on the current edit: recomputed (debounced) as the user taps.
  const [insight, setInsight] = useState<HalftimeInsightRuns | null>(null)
  const [computing, setComputing] = useState(false)
  useEffect(() => {
    if (!editing || !edited) {
      setInsight(null)
      setComputing(false)
      return
    }
    let cancelled = false
    setComputing(true)
    const timer = setTimeout(async () => {
      const runs = await runHalftimeInsight(
        firstHalf,
        buildSheet(match.home, htLineups.home),
        buildSheet(match.away, htLineups.away),
      )
      if (cancelled) return
      setInsight(runs)
      setComputing(false)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editing, edited, htLineups, firstHalf, match])

  const shifts = useMemo(
    () => (edited ? buildHalftimeShifts(match, lineups, htLineups) : []),
    [edited, match, lineups, htLineups],
  )

  const cards = useMemo(
    () => firstHalf.events.filter((e) => e.type === 'yellow-card' || e.type === 'red-card'),
    [firstHalf],
  )
  const score = { home: firstHalf.home.goals, away: firstHalf.away.goals }

  if (!editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${CARD} mx-auto max-w-2xl px-6 py-8 text-center`}
      >
        <div className="font-display text-2xl font-black uppercase tracking-widest text-card-yellow">
          Half-time
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span style={{ color: home.color }}>{home.name}</span>{' '}
          <span className="font-display font-black text-floodlight tabular-nums">
            {score.home}–{score.away}
          </span>{' '}
          <span style={{ color: away.color }}>{away.name}</span> at the break. The dressing rooms
          are yours: change personnel or shape for either side, or trust what you saw.
        </p>

        {cards.length > 0 && (
          <ul className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-floodlight/85">
            {cards.map((card, i) => (
              <li key={i} className="flex items-center gap-1.5 tabular-nums">
                <span
                  className={`inline-block h-3 w-2.5 rounded-[2px] ${
                    card.type === 'red-card' ? 'bg-card-red' : 'bg-card-yellow'
                  }`}
                />
                {card.minute}&#8242; {card.player?.name}
                {card.teamId && <TeamFlag teamId={card.teamId as TeamId} className="h-2.5" title={card.teamId} />}
              </li>
            ))}
          </ul>
        )}

        <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setEditing(true)}
            disabled={resuming}
            className={`flex-1 rounded-lg border border-card-yellow/50 bg-card-yellow/10 px-5 py-3 font-display text-sm font-black uppercase tracking-widest text-card-yellow transition-colors hover:border-card-yellow disabled:opacity-60 ${FOCUS_RING}`}
          >
            Change something
          </button>
          <button
            onClick={() => onResume(lineups, false)}
            disabled={resuming}
            className={`flex-1 px-5 py-3 disabled:opacity-60 ${BTN_SECONDARY}`}
          >
            {resuming ? 'Heading back out…' : 'Send them back out unchanged ▸'}
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mx-auto mb-4 flex max-w-6xl items-baseline justify-between gap-3">
        <button
          onClick={() => setEditing(false)}
          className={`rounded px-1 text-sm font-semibold text-muted transition-colors hover:text-floodlight ${FOCUS_RING}`}
        >
          ◂ Back to the break
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
          Half-time changes · {home.shortName} {score.home}–{score.away} {away.shortName}
        </span>
      </div>
      <LineupEditor
        match={match}
        lineups={htLineups}
        dispatch={dispatch}
        onKickOff={() => onResume(htLineups, edited)}
        simulating={resuming}
        mode="halftime"
        firstHalfStarters={{
          home: lineups.home.startersBySlot,
          away: lineups.away.startersBySlot,
        }}
        dismissed={dismissed}
        insight={
          edited ? (
            <HalftimeInsightStrip
              insight={insight}
              computing={computing}
              shifts={shifts}
              home={home}
              away={away}
            />
          ) : undefined
        }
      />
    </motion.div>
  )
}

interface HalftimeInsightStripProps {
  insight: HalftimeInsightRuns | null
  computing: boolean
  shifts: ReturnType<typeof buildHalftimeShifts>
  home: TeamInfo
  away: TeamInfo
}

/**
 * The half-time cousin of the result screen's InsightPanel: the rest of THIS
 * match replayed from the frozen 45' state, once as things stand and once
 * with the proposed changes — same seeds, so the delta is the change alone.
 */
function HalftimeInsightStrip({ insight, computing, shifts, home, away }: HalftimeInsightStripProps) {
  if (!insight) {
    return (
      <div className={`${PANEL} p-4`} data-testid="halftime-insight">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
          Is this a good idea?
        </h3>
        <p className="animate-pulse text-sm text-muted">Replaying the second half 1,000 times…</p>
      </div>
    )
  }

  const runs = insight.edited.runs.toLocaleString('en-US')
  const groups = [
    { team: home, base: insight.unchanged.homeWinPct, now: insight.edited.homeWinPct },
    { team: away, base: insight.unchanged.awayWinPct, now: insight.edited.awayWinPct },
  ]
  const topShifts = [...shifts]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 2)

  return (
    <div className={`${PANEL} p-4 ${computing ? 'opacity-70' : ''}`} data-testid="halftime-insight">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted">
        Is this a good idea?
      </h3>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        The rest of this match — same score, same cards — replayed {runs} times from the 45&#8242;
        whistle, with and without your changes.
      </p>
      <div className="space-y-4">
        {groups.map((group, index) => (
          <div key={group.team.id}>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted">
              <TeamFlag teamId={group.team.id} className="h-3" title="" />
              <span style={{ color: group.team.color }}>{group.team.name}</span> win from here
            </h4>
            <div className="space-y-1.5">
              <CompareRow
                label="As is"
                pct={group.base}
                color={group.team.chartColor}
                faded
                delay={0.05 + index * 0.16}
                runs={runs}
              />
              <CompareRow
                label="Your XI"
                pct={group.now}
                color={group.team.chartColor}
                delay={0.13 + index * 0.16}
                runs={runs}
                delta={group.now - group.base}
              />
            </div>
          </div>
        ))}
      </div>
      {topShifts.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-floodlight/85">
          {topShifts.map((shift) => (
            <li key={`${shift.team.id}-${shift.phase}`} className="tabular-nums">
              <span style={{ color: shift.team.color }}>{shift.team.shortName}</span>{' '}
              <span className="text-muted">{shift.label.toLowerCase()}</span>{' '}
              {shift.after < shift.before ? 'drops' : 'climbs'} from {shift.before} to{' '}
              <span className={shift.after < shift.before ? 'text-card-red' : 'text-mexico'}>
                {shift.after}
              </span>
            </li>
          ))}
        </ul>
      )}
      {computing && <p className="mt-2 animate-pulse text-[11px] text-muted">Updating…</p>}
    </div>
  )
}
