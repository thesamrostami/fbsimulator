import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PlayedMatch, RealGoal } from '../../data/matches'
import { TEAMS, type TeamInfo } from '../../data/teams'
import type { MatchEvent, MonteCarloResult, SimResult } from '../../engine/types'
import { buildKeyDifferences, shareSummary } from '../../services/keyDifferences'
import { buildMatchReport } from '../../services/matchReport'
import { rateMatch } from '../../services/playerRatings'
import { buildWhyThisResult } from '../../services/whyThisResult'
import type { LineupState, SideKey } from '../../state/appState'
import { EventCard } from '../match/EventCard'
import { TerrainReplay } from '../match/TerrainReplay'
import { InsightPanel } from '../result/InsightPanel'
import { PlayerRatingsTable, RatingBadge } from '../result/PlayerRatingsTable'
import { ShotMap } from '../result/ShotMap'
import { StatsTable } from '../result/StatsTable'
import { SourceBadge } from '../ui/SourceBadge'
import { TeamFlag } from '../ui/TeamFlag'
import { BTN_SECONDARY, FOCUS_RING } from '../../ui/theme'
import { copyText } from '../../ui/clipboard'

type CopyStatus = 'idle' | 'ok' | 'fail'

interface ResultScreenProps {
  match: PlayedMatch
  sim: SimResult
  /** The kick-off insight; null while the worker is still replaying the 1,000 nights. */
  monteCarlo: MonteCarloResult | null
  lineups: Record<SideKey, LineupState>
  onEdit: () => void
  onRerun: () => void
  rerunning: boolean
}

function Badge({ children }: { children: string }) {
  return (
    <span className="ml-2 inline-block rounded-md border border-gold/50 bg-gold/10 px-1.5 py-0.5 align-middle text-[10px] font-black uppercase tracking-widest text-gold">
      {children}
    </span>
  )
}

interface ScorePanelProps {
  title: string
  home: TeamInfo
  away: TeamInfo
  score: { home: number; away: number }
  badge?: string
  subline?: string
  highlight: boolean
  /** Show the real-data provenance pill next to the title. */
  realData?: boolean
}

function ScorePanel({ title, home, away, score, badge, subline, highlight, realData }: ScorePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: highlight ? 0 : 0.12 }}
      className={`flex-1 rounded-2xl border p-6 text-center ${
        highlight ? 'border-gold/50 bg-gold/5' : 'border-ink/10 bg-night-2/70'
      }`}
    >
      <div className={`mb-3 text-[11px] font-bold uppercase tracking-widest ${highlight ? 'text-gold' : 'text-muted'}`}>
        {title}
        {badge && <Badge>{badge}</Badge>}
        {realData && (
          <span className="ml-2">
            <SourceBadge kind="real" />
          </span>
        )}
      </div>
      <div className="font-display text-6xl font-black tabular-nums text-floodlight sm:text-7xl">
        <span style={{ color: home.color }}>{score.home}</span>
        <span className="mx-2 text-muted">–</span>
        <span style={{ color: away.color }}>{score.away}</span>
      </div>
      <div className="mt-3 flex justify-center gap-6 text-[11px] font-bold uppercase tracking-widest text-muted">
        <span className="inline-flex items-center gap-1.5">
          <TeamFlag teamId={home.id} className="h-3" title="" /> {home.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {away.name} <TeamFlag teamId={away.id} className="h-3" title="" />
        </span>
      </div>
      {subline && <div className="mt-2 text-xs text-muted">{subline}</div>}
    </motion.div>
  )
}

function GoalMinutes({ title, entries }: { title: string; entries: { minute: number; team: TeamInfo; label?: string }[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No goals.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-floodlight/85">
              <span className="w-10 shrink-0 text-right font-display font-black tabular-nums text-muted">
                {entry.minute}&#8242;
              </span>
              <span aria-hidden="true">⚽</span>
              <TeamFlag teamId={entry.team.id} className="h-3.5" title="" />
              <span className="font-semibold" style={{ color: entry.team.color }}>
                {entry.team.shortName}
              </span>
              {entry.label && <span className="text-muted">{entry.label}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResultScreen({ match, sim, monteCarlo, lineups, onEdit, onRerun, rerunning }: ResultScreenProps) {
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]
  const differences = useMemo(() => buildKeyDifferences(match, sim), [match, sim])
  const why = useMemo(() => buildWhyThisResult(match, lineups), [match, lineups])
  const ratings = useMemo(() => rateMatch(sim), [sim])
  const report = useMemo(() => buildMatchReport(match, sim, ratings), [match, sim, ratings])
  const [tab, setTab] = useState<'summary' | 'analysis' | 'report'>('summary')
  const [summaryStatus, setSummaryStatus] = useState<CopyStatus>('idle')
  const [reportStatus, setReportStatus] = useState<CopyStatus>('idle')

  const copyReport = async () => {
    const ok = await copyText(report.text)
    setReportStatus(ok ? 'ok' : 'fail')
    if (ok) setTimeout(() => setReportStatus('idle'), 1800)
  }

  const topLine = monteCarlo?.topScorelines[0]
  const summary = monteCarlo
    ? shareSummary(match, sim, monteCarlo, topLine ? `${topLine.home}–${topLine.away}` : '—', ratings.motm)
    : null

  const copy = async () => {
    if (!summary) return
    const ok = await copyText(summary)
    setSummaryStatus(ok ? 'ok' : 'fail')
    if (ok) setTimeout(() => setSummaryStatus('idle'), 1800)
  }

  const simBadge = sim.shootout ? 'PENS' : sim.wentToExtraTime ? 'AET' : undefined
  const simSubline = sim.shootout
    ? `${(sim.shootout.winner === 'home' ? home : away).name} won the shootout ${sim.shootout.score.home}–${sim.shootout.score.away}`
    : 'One possible night — every rerun writes a new one'

  const realBadge = match.real.decidedBy
  const realSubline =
    match.real.decidedBy === 'PENS' && match.real.pensWinner
      ? `${(match.real.pensWinner === 'home' ? home : away).name} won the shootout`
      : match.real.note

  const teamFor = (teamId: string) => (teamId === home.id ? home : away)
  const realGoalEntries = match.real.goals.map((goal: RealGoal) => ({
    minute: goal.minute,
    team: teamFor(goal.teamId),
    label: [goal.player, goal.extraTime ? '(ET)' : undefined].filter(Boolean).join(' '),
  }))
  const simGoalEntries = sim.events
    .filter((e: MatchEvent) => e.type === 'goal')
    .map((goal) => ({
      minute: goal.minute,
      team: goal.side === 'home' ? home : away,
      label: [goal.player?.name, goal.minute > 90 ? '(ET)' : undefined].filter(Boolean).join(' '),
    }))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <ScorePanel
          title="How it played out"
          home={home}
          away={away}
          score={sim.finalScore}
          badge={simBadge}
          subline={simSubline}
          highlight
        />
        <div className="flex items-center justify-center font-display text-lg font-black uppercase text-muted">vs</div>
        <ScorePanel
          title={`Real match · ${match.date}`}
          home={home}
          away={away}
          score={match.real.score}
          badge={realBadge}
          subline={realSubline}
          highlight={false}
          realData
        />
      </div>

      {/* Summary ↔ full match report */}
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Result view">
        {(
          [
            ['summary', 'Summary'],
            ['analysis', 'Analysis'],
            ['report', 'Match report'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-2 font-display text-xs font-black uppercase tracking-wider transition-colors sm:px-5 sm:text-sm sm:tracking-widest ${FOCUS_RING} ${
              tab === key
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-ink/10 text-muted hover:border-ink/30 hover:text-floodlight'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analysis' && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="rounded-2xl border border-ink/10 bg-night-2/70 p-6">
              <h2 className="mb-4 font-display text-lg font-black uppercase tracking-widest text-floodlight">Match stats</h2>
              <StatsTable home={home} away={away} stats={sim.stats} />
            </div>
            <div className="rounded-2xl border border-ink/10 bg-night-2/70 p-6">
              <h2 className="mb-4 font-display text-lg font-black uppercase tracking-widest text-floodlight">Shot map</h2>
              <ShotMap events={sim.events} home={home} away={away} />
            </div>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-night-2/70 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-black uppercase tracking-widest text-floodlight">Player ratings</h2>
              <SourceBadge kind="estimated" />
            </div>
            <PlayerRatingsTable ratings={ratings} home={home} away={away} />
          </div>
        </motion.div>
      )}

      {tab === 'report' && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-ink/10 bg-night-2/70 p-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-black uppercase tracking-widest text-floodlight">
              Match report
            </h2>
            <span className="text-xs text-muted">
              tap any event for the numbers behind it · seed {sim.seed}
            </span>
            <button onClick={copyReport} className={`ml-auto px-4 py-2 ${BTN_SECONDARY}`}>
              {reportStatus === 'ok' ? '✓ Copied!' : reportStatus === 'fail' ? 'Select below to copy' : 'Copy match report'}
            </button>
          </div>
          {reportStatus === 'fail' && (
            <textarea
              readOnly
              aria-label="Match report text — select all and copy"
              value={report.text}
              onFocus={(e) => e.currentTarget.select()}
              className="scroll-area mb-4 h-40 w-full resize-none rounded-lg border border-gold/40 bg-night p-3 font-mono text-xs leading-relaxed text-floodlight/85"
            />
          )}
          <div className="flex flex-col gap-2">
            {report.entries.map((entry, index) =>
              entry.kind === 'event' ? (
                <EventCard
                  key={index}
                  event={entry.event}
                  homeShort={home.shortName}
                  awayShort={away.shortName}
                />
              ) : (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border border-ink/10 bg-night-2/80 px-3 py-2.5"
                  style={{
                    borderLeft: `3px solid ${(entry.kick.side === 'home' ? home : away).color}`,
                  }}
                >
                  <span className="w-9 shrink-0 pt-0.5 text-right font-display text-sm font-black tabular-nums text-muted">
                    PK{entry.number}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`shrink-0 leading-6 ${entry.kick.scored ? 'text-mexico' : 'text-card-red'}`}
                  >
                    {entry.kick.scored ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-floodlight/85">{entry.kick.commentary}</p>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                      {(entry.kick.side === 'home' ? home : away).shortName} · {Math.round(entry.kick.chance * 100)}%
                      odds{entry.kick.pressure ? ' · must-score' : ''} · {entry.kick.scoreAfter.home}–
                      {entry.kick.scoreAfter.away}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </motion.div>
      )}

      {tab === 'summary' && (
      <>
      {/* At a glance: the man of the match and the headline numbers. */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-5 grid gap-5 rounded-2xl border border-ink/10 bg-night-2/70 p-6 md:grid-cols-[minmax(0,18rem)_1fr]"
      >
        {ratings.motm && (
          <div className="flex items-center gap-4 md:border-r md:border-ink/10 md:pr-5" data-testid="motm">
            <RatingBadge rating={ratings.motm.rating} large />
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-gold">★ Man of the match</div>
              <div className="font-display text-xl font-black uppercase leading-tight tracking-wide text-floodlight">
                {ratings.motm.name}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                <TeamFlag teamId={(ratings.motm.side === 'home' ? home : away).id} className="h-3" title="" />
                <span style={{ color: (ratings.motm.side === 'home' ? home : away).color }}>
                  {(ratings.motm.side === 'home' ? home : away).shortName}
                </span>
                · {ratings.motm.label}
                {ratings.motm.stats.goals > 0 && ` · ${ratings.motm.stats.goals} goal${ratings.motm.stats.goals === 1 ? '' : 's'}`}
                {ratings.motm.stats.assists > 0 && ` · ${ratings.motm.stats.assists} assist${ratings.motm.stats.assists === 1 ? '' : 's'}`}
                {ratings.motm.line === 'GK' && ratings.motm.stats.saves > 0 && ` · ${ratings.motm.stats.saves} saves`}
              </div>
              <button
                onClick={() => setTab('analysis')}
                className={`mt-1 rounded text-[11px] font-semibold text-muted underline-offset-2 hover:text-floodlight hover:underline ${FOCUS_RING}`}
              >
                All ratings, stats and the shot map →
              </button>
            </div>
          </div>
        )}
        <StatsTable home={home} away={away} stats={sim.stats} compact />
      </motion.div>

      {/* The finished match, replayed as a 3D territory portrait — its own playhead */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-5 overflow-hidden rounded-2xl border border-ink/10 bg-night-2/70 p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-floodlight">
            The match, replayed
          </h2>
        </div>
        <TerrainReplay sim={sim} home={home} away={away} />
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Every pass, shot and card of this replay on the 3D pitch — play, scrub, or watch it again.
        </p>
      </motion.div>

      {/* The insight: the 1,000-replay signal, ahead of the one-night story */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-5 rounded-2xl border border-gold/50 bg-gold/5 p-6"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-gold">
            {why.edited ? 'Did your changes help?' : 'What 1,000 replays say'}
          </h2>
          <SourceBadge kind="estimated" />
        </div>
        {monteCarlo ? (
          <InsightPanel match={match} monteCarlo={monteCarlo} why={why} home={home} away={away} />
        ) : (
          <p className="animate-pulse text-sm text-muted" data-testid="insight-pending">
            Replaying these lineups 1,000 times…
          </p>
        )}
      </motion.div>

      {/* Goal-by-goal comparison */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-5 grid gap-6 rounded-2xl border border-ink/10 bg-night-2/70 p-6 sm:grid-cols-2"
      >
        <GoalMinutes title="Goals in your replay" entries={simGoalEntries} />
        <GoalMinutes title="Goals on the real night" entries={realGoalEntries} />
      </motion.div>

      {/* Why this result: the numbers the sim actually ran on */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-5 rounded-2xl border border-ink/10 bg-night-2/70 p-6"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-floodlight">
            Why this result
          </h2>
          <SourceBadge kind="estimated" />
          <Link
            to="/how-it-works"
            className={`ml-auto rounded text-xs font-semibold text-muted underline-offset-2 transition-colors hover:text-floodlight hover:underline ${FOCUS_RING}`}
          >
            How the engine works →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
              Team ratings in your simulation
            </h3>
            <ul className="space-y-1.5 text-sm text-floodlight/85">
              {why.gaps.map((gap) => (
                <li key={gap.phase} className="flex items-center gap-2 tabular-nums">
                  <span className="w-24 text-muted">{gap.label}</span>
                  <span style={{ color: home.color }}>{gap.home}</span>
                  <span className="text-muted">–</span>
                  <span style={{ color: away.color }}>{gap.away}</span>
                  <span className="ml-2 text-xs text-muted">
                    {gap.gap === 0 ? 'even' : `${gap.advantage.name} +${Math.abs(gap.gap)}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Chance creation was weighted by the real possession split:{' '}
              <span className="tabular-nums">
                {home.shortName} {why.possession.home}% – {why.possession.away}% {away.shortName}
              </span>
              . <SourceBadge kind="real" short />
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                Your changes vs the real XI
              </h3>
              {why.formationChanges.length > 0 && (
                <ul className="mb-2 space-y-1.5 text-sm text-floodlight/85">
                  {why.formationChanges.map((change) => (
                    <li key={change.team.id}>
                      You switched <span style={{ color: change.team.color }}>{change.team.name}</span> from{' '}
                      <span className="font-display font-black">{change.from}</span> to{' '}
                      <span className="font-display font-black">{change.to}</span> — the engine applied that
                      shape's modifiers.
                    </li>
                  ))}
                </ul>
              )}
              {why.shifts.length === 0 ? (
                <p className="text-sm text-muted">
                  {why.edited
                    ? 'Your changes barely moved the phase ratings — the players you swapped rate about the same.'
                    : 'You fielded the real starting XIs — no rating shifts.'}
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm text-floodlight/85">
                  {why.shifts.map((shift) => (
                    <li key={`${shift.team.id}-${shift.phase}`} className="tabular-nums">
                      <span style={{ color: shift.team.color }}>{shift.team.shortName}</span>{' '}
                      <span className="text-muted">{shift.label.toLowerCase()}</span> {shift.before} →{' '}
                      <span className={shift.after < shift.before ? 'text-card-red' : 'text-mexico'}>
                        {shift.after}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {why.outOfPosition.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                  Out-of-position penalties applied
                </h3>
                <ul className="space-y-1.5 text-sm text-floodlight/85">
                  {why.outOfPosition.flatMap((side) =>
                    side.flags.map((flag) => (
                      <li key={`${side.team.id}-${flag.playerId}-${flag.slotId}`}>
                        <span style={{ color: side.team.color }}>{side.team.shortName}</span>{' '}
                        <span className="font-semibold">{flag.playerName}</span>
                        <span className="text-muted">
                          {' '}
                          — {flag.naturalLine} at {flag.slotLabel}, ratings ×{flag.penalty.toFixed(2)}
                        </span>
                      </li>
                    )),
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-ink/10 bg-night-2/70 p-6"
      >
        <h2 className="mb-4 font-display text-lg font-black uppercase tracking-widest text-floodlight">
          What changed
        </h2>
        <ul className="space-y-3">
          {differences.map((diff, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex gap-3 text-sm leading-relaxed text-floodlight/85"
            >
              {diff.teamId ? (
                <TeamFlag teamId={diff.teamId} className="mt-0.5 h-3.5 shrink-0" title="" />
              ) : (
                <span aria-hidden="true">{diff.icon}</span>
              )}
              <span>{diff.text}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Share card */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-5 rounded-2xl border border-ink/10 bg-night-2/70 p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <pre className="scroll-area flex-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-ink/10 bg-night p-4 font-mono text-xs leading-relaxed text-floodlight/85">
            {summary ?? 'Summary ready once the 1,000 replays land…'}
          </pre>
          <button onClick={copy} disabled={!summary} className={`shrink-0 px-5 py-3 disabled:opacity-50 ${BTN_SECONDARY}`}>
            {summaryStatus === 'ok' ? '✓ Copied!' : summaryStatus === 'fail' ? 'Select text to copy' : 'Copy summary'}
          </button>
        </div>
        {summaryStatus === 'fail' && (
          <p className="mt-2 text-[11px] text-gold">
            Couldn't reach the clipboard — select the text above and copy it manually.
          </p>
        )}
      </motion.div>
      </>
      )}

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/bracket" className={`px-6 py-3 text-center ${BTN_SECONDARY}`}>
          ◂ Back to the bracket
        </Link>
        <button onClick={onEdit} className={`px-6 py-3 ${BTN_SECONDARY}`}>
          Tweak the lineups
        </button>
        <motion.button
          onClick={onRerun}
          disabled={rerunning}
          whileHover={rerunning ? undefined : { scale: 1.02 }}
          whileTap={rerunning ? undefined : { scale: 0.97 }}
          className={`rounded-lg px-6 py-3 font-display text-sm font-black uppercase tracking-widest text-night disabled:opacity-70 ${FOCUS_RING}`}
          style={{ background: `linear-gradient(100deg, ${home.color}, ${away.color})` }}
        >
          {rerunning ? 'Simulating…' : 'Run it again ↻'}
        </motion.button>
      </div>
    </div>
  )
}
