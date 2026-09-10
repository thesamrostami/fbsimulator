import { motion } from 'framer-motion'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { formationSlots } from '../../data/formations'
import type { PlayedMatch } from '../../data/matches'
import type { TeamId, TeamInfo } from '../../data/teams'
import { HALFTIME_MINUTE, sentOffIds, type HalftimeState } from '../../engine/simulate'
import { lineupsAt, nextPauseAfter, substitutionLedger, type MatchScript } from '../../services/matchScript'
import { pauseInsight, type PauseInsightRuns } from '../../services/simulation'
import { buildHalftimeShifts, tacticsChangesBetween, type TacticsChange } from '../../services/whyThisResult'
import { makePauseReducer, MAX_HALFTIME_SUBS, sameTactics, type LineupState, type SideKey } from '../../state/appState'
import { BTN_SECONDARY, CARD, FOCUS_RING, PANEL } from '../../ui/theme'
import { CompareRow } from '../result/InsightPanel'
import { LineupEditor } from '../screens/LineupEditor'
import { TeamFlag } from '../ui/TeamFlag'

interface PauseBreakProps {
  match: PlayedMatch
  /** The live match frozen at `pausedAt`. Read-only here; the parent resumes it. */
  live: HalftimeState
  pausedAt: number
  /** The match so far as data: kick-off lineups and confirmed changes. */
  script: MatchScript
  home: TeamInfo
  away: TeamInfo
  resuming: boolean
  /** Whether the match should stop again at the next substitution window. */
  stopAtWindows: boolean
  onStopAtWindowsChange: (value: boolean) => void
  onResume: (lineups: Record<SideKey, LineupState>, edited: boolean) => void
}

/**
 * A pause in the match — the 45' whistle or a substitution window at 60'
 * or 75': score and cards so far, then either straight back out or into the
 * lineup editor (match rules: five substitutions across the windows, a
 * player who has left cannot return) with a remainder-only Monte Carlo
 * verdict on any change before it is confirmed.
 */
export function PauseBreak({
  match,
  live,
  pausedAt,
  script,
  home,
  away,
  resuming,
  stopAtWindows,
  onStopAtWindowsChange,
  onResume,
}: PauseBreakProps) {
  const [editing, setEditing] = useState(false)
  const halftime = pausedAt === HALFTIME_MINUTE
  const nextWindow = nextPauseAfter(pausedAt)

  // The XIs on the pitch right now, and the substitution ledger so far.
  const baseline = useMemo(() => lineupsAt(script, pausedAt), [script, pausedAt])
  const dismissed = useMemo(() => sentOffIds(live), [live])
  const ledger = useMemo(
    () => ({ home: substitutionLedger(script, 'home'), away: substitutionLedger(script, 'away') }),
    [script],
  )
  const allowance = useMemo(
    () => ({
      used: { home: ledger.home.used, away: ledger.away.used },
      unavailable: {
        home: new Set([...ledger.home.off, ...dismissed]),
        away: new Set([...ledger.away.off, ...dismissed]),
      },
    }),
    [ledger, dismissed],
  )
  const reducer = useMemo(() => makePauseReducer(baseline, allowance), [baseline, allowance])
  const [draft, dispatch] = useReducer(reducer, baseline)

  const edited = useMemo(
    () =>
      (['home', 'away'] as const).some((side) => {
        if (draft[side].formation !== baseline[side].formation) return true
        if (!sameTactics(draft[side].tactics, baseline[side].tactics)) return true
        return formationSlots(baseline[side].formation).some(
          (slot) => draft[side].startersBySlot[slot.id] !== baseline[side].startersBySlot[slot.id],
        )
      }),
    [draft, baseline],
  )

  // The verdict on the current edit: recomputed (debounced) as the user taps, on the worker.
  const [insight, setInsight] = useState<PauseInsightRuns | null>(null)
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
      try {
        const runs = await pauseInsight(match, script, pausedAt, draft)
        if (cancelled) return
        setInsight(runs)
      } catch {
        if (!cancelled) setInsight(null)
      } finally {
        if (!cancelled) setComputing(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editing, edited, draft, script, pausedAt, match])

  const shifts = useMemo(() => (edited ? buildHalftimeShifts(match, baseline, draft) : []), [edited, match, baseline, draft])
  const tacticsChanges = useMemo(
    () => (edited ? tacticsChangesBetween(match, baseline, draft) : []),
    [edited, match, baseline, draft],
  )

  const cards = useMemo(
    () => live.events.filter((e) => e.type === 'yellow-card' || e.type === 'red-card'),
    [live],
  )
  const score = { home: live.home.goals, away: live.away.goals }
  const subsLeft = (side: SideKey) => MAX_HALFTIME_SUBS - ledger[side].used

  const windowToggle =
    nextWindow !== null ? (
      <label className="mx-auto mt-4 flex max-w-md cursor-pointer items-center justify-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={stopAtWindows}
          onChange={(e) => onStopAtWindowsChange(e.target.checked)}
          className="accent-card-yellow"
        />
        Stop again at {nextWindow}&#8242; for substitutions
      </label>
    ) : null

  if (!editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${CARD} mx-auto max-w-2xl px-6 py-8 text-center`}
        data-testid="pause-break"
      >
        <div className="font-display text-2xl font-black uppercase tracking-widest text-gold">
          {halftime ? 'Half-time' : `${pausedAt}′ — substitution window`}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span style={{ color: home.color }}>{home.name}</span>{' '}
          <span className="font-display font-black text-floodlight tabular-nums">
            {score.home}–{score.away}
          </span>{' '}
          <span style={{ color: away.color }}>{away.name}</span>{' '}
          {halftime
            ? 'at the break. The dressing rooms are yours: change personnel or shape for either side, or trust what you saw.'
            : 'as the board goes up. Fresh legs, a new shape, different instructions — or let it run.'}
        </p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-muted">
          Substitutions left · {home.shortName} {subsLeft('home')} · {away.shortName} {subsLeft('away')}
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
            className={`flex-1 rounded-lg border border-gold/50 bg-gold/10 px-5 py-3 font-display text-sm font-black uppercase tracking-widest text-gold transition-colors hover:border-gold disabled:opacity-60 ${FOCUS_RING}`}
          >
            Change something
          </button>
          <button
            onClick={() => onResume(baseline, false)}
            disabled={resuming}
            className={`flex-1 px-5 py-3 disabled:opacity-60 ${BTN_SECONDARY}`}
          >
            {resuming ? 'Heading back out…' : halftime ? 'Send them back out unchanged ▸' : 'Play on ▸'}
          </button>
        </div>
        {windowToggle}
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
          ◂ Back to the {halftime ? 'break' : 'touchline'}
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
          {halftime ? 'Half-time changes' : `${pausedAt}′ changes`} · {home.shortName} {score.home}–{score.away}{' '}
          {away.shortName}
        </span>
      </div>
      <LineupEditor
        match={match}
        lineups={draft}
        dispatch={dispatch}
        onKickOff={() => onResume(draft, edited)}
        simulating={resuming}
        mode="pause"
        pauseMinute={pausedAt}
        firstHalfStarters={{
          home: baseline.home.startersBySlot,
          away: baseline.away.startersBySlot,
        }}
        subsUsedBefore={{ home: ledger.home.used, away: ledger.away.used }}
        unavailable={{ home: ledger.home.off, away: ledger.away.off }}
        dismissed={dismissed}
        insight={
          edited ? (
            <PauseInsightStrip
              insight={insight}
              computing={computing}
              shifts={shifts}
              tacticsChanges={tacticsChanges}
              pausedAt={pausedAt}
              home={home}
              away={away}
            />
          ) : undefined
        }
        footer={windowToggle}
      />
    </motion.div>
  )
}

interface PauseInsightStripProps {
  insight: PauseInsightRuns | null
  computing: boolean
  shifts: ReturnType<typeof buildHalftimeShifts>
  tacticsChanges: TacticsChange[]
  pausedAt: number
  home: TeamInfo
  away: TeamInfo
}

/**
 * The pause cousin of the result screen's InsightPanel: the rest of THIS
 * match replayed from the frozen state, once as things stand and once
 * with the proposed changes — same seeds, so the delta is the change alone.
 */
function PauseInsightStrip({ insight, computing, shifts, tacticsChanges, pausedAt, home, away }: PauseInsightStripProps) {
  if (!insight) {
    return (
      <div className={`${PANEL} p-4`} data-testid="halftime-insight">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
          Is this a good idea?
        </h3>
        <p className="animate-pulse text-sm text-muted">Replaying the rest of the match 1,000 times…</p>
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
        The rest of this match — same score, same cards — replayed {runs} times from the {pausedAt}&#8242;
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
      {(topShifts.length > 0 || tacticsChanges.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-floodlight/85">
          {tacticsChanges.map((change) => (
            <li key={`tactics-${change.team.id}`}>
              <span style={{ color: change.team.color }}>{change.team.shortName}</span>{' '}
              <span className="text-muted">now play</span> {change.summary}
            </li>
          ))}
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
