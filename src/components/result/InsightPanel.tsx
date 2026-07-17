import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { PlayedMatch } from '../../data/matches'
import type { TeamInfo } from '../../data/teams'
import type { MonteCarloResult } from '../../engine/types'
import { baselineMonteCarlo } from '../../services/simulation'
import type { WhyThisResult } from '../../services/whyThisResult'
import { NEUTRAL_MARK } from '../../ui/theme'
import { TeamFlag } from '../ui/TeamFlag'
import { ProbabilityBars } from './ProbabilityBars'

interface InsightPanelProps {
  match: PlayedMatch
  /** Monte Carlo for the lineups the user actually fielded. */
  monteCarlo: MonteCarloResult
  why: WhyThisResult
  home: TeamInfo
  away: TeamInfo
}

interface CompareRowProps {
  label: string
  pct: number
  color: string
  /** Baseline rows render the same hue faded so "your XI" carries the weight. */
  faded?: boolean
  delay: number
  runs: string
  /** Edited-minus-baseline points; rendered as the row's verdict chip. */
  delta?: number
  /** Whether a positive delta is good news (team rows) or just neutral (draw). */
  deltaIsNeutral?: boolean
}

function deltaLabel(delta: number): string {
  if (Math.abs(delta) < 0.05) return 'no change'
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts`
}

/** Shared with the half-time insight strip — same visual row, different moment. */
export function CompareRow({ label, pct, color, faded, delay, runs, delta, deltaIsNeutral }: CompareRowProps) {
  const deltaClass =
    delta === undefined || Math.abs(delta) < 0.05 || deltaIsNeutral
      ? 'text-muted'
      : delta > 0
        ? 'text-mexico'
        : 'text-card-red'
  return (
    <div className="flex items-center gap-3" title={`${label}: ${pct}% of ${runs} replays`}>
      <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted">{label}</span>
      <div className="h-3.5 flex-1 rounded-sm bg-white/5">
        <motion.div
          className="h-full"
          style={{ background: color, opacity: faded ? 0.45 : 1, borderRadius: '0 4px 4px 0' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 20, delay }}
        />
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
        className="w-14 shrink-0 text-right font-display text-base font-black tabular-nums text-floodlight"
      >
        {pct.toFixed(1)}%
      </motion.span>
      <span className={`w-20 shrink-0 text-right text-xs font-bold tabular-nums ${deltaClass}`}>
        {delta !== undefined && deltaLabel(delta)}
      </span>
    </div>
  )
}

/**
 * The insight: what the 1,000-replay Monte Carlo says, as opposed to the one
 * story the single match tells. Unedited lineups get the plain win/draw/loss
 * split; edited lineups get real-XI vs your-XI win% with the phase shifts
 * that caused the move. Baseline and edited runs share one fixed seed, so the
 * delta is the lineups' doing, not sampling noise.
 */
export function InsightPanel({ match, monteCarlo, why, home, away }: InsightPanelProps) {
  const baseline = useMemo(() => baselineMonteCarlo(match), [match])
  const runs = monteCarlo.runs.toLocaleString('en-US')
  const knockout = monteCarlo.extraTimePct !== undefined

  if (!why.edited) {
    const favourite = monteCarlo.homeWinPct >= monteCarlo.awayWinPct ? home : away
    return (
      <div>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          This is the real lineup — {runs} replays show how often {favourite.name} win it on chance
          alone. The match above is just one of those nights.
        </p>
        <ProbabilityBars monteCarlo={monteCarlo} home={home} away={away} />
      </div>
    )
  }

  const groups = [
    { team: home, base: baseline.homeWinPct, now: monteCarlo.homeWinPct },
    { team: away, base: baseline.awayWinPct, now: monteCarlo.awayWinPct },
  ]
  const showDraw = !knockout && (baseline.drawPct > 0 || monteCarlo.drawPct > 0)

  const topShifts = [...why.shifts]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 2)

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        The same {runs} nights replayed twice — once with the real starting XIs, once with yours.
        This is the signal; the match above is one story from it.
      </p>

      <div className="space-y-5">
        {groups.map((group, index) => (
          <div key={group.team.id}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted">
              <TeamFlag teamId={group.team.id} className="h-3" title="" />
              <span style={{ color: group.team.color }}>{group.team.name}</span> win
            </h3>
            <div className="space-y-1.5">
              <CompareRow
                label="Real XI"
                pct={group.base}
                color={group.team.chartColor}
                faded
                delay={0.15 + index * 0.24}
                runs={runs}
              />
              <CompareRow
                label="Your XI"
                pct={group.now}
                color={group.team.chartColor}
                delay={0.27 + index * 0.24}
                runs={runs}
                delta={group.now - group.base}
              />
            </div>
          </div>
        ))}

        {showDraw && (
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Draw</h3>
            <div className="space-y-1.5">
              <CompareRow label="Real XI" pct={baseline.drawPct} color={NEUTRAL_MARK} faded delay={0.63} runs={runs} />
              <CompareRow
                label="Your XI"
                pct={monteCarlo.drawPct}
                color={NEUTRAL_MARK}
                delay={0.75}
                runs={runs}
                delta={monteCarlo.drawPct - baseline.drawPct}
                deltaIsNeutral
              />
            </div>
          </div>
        )}
      </div>

      <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-muted">
        Why the odds moved
      </h3>
      {topShifts.length === 0 ? (
        <p className="text-sm leading-relaxed text-floodlight/85">
          Your changes barely moved the phase ratings — the players you swapped rate about the same,
          so the odds stay close to the real XI's.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {topShifts.map((shift, index) => (
            <li key={`${shift.team.id}-${shift.phase}`} className="text-sm leading-relaxed text-floodlight/85 tabular-nums">
              <span style={{ color: shift.team.color }}>{shift.team.shortName}</span>{' '}
              <span className="text-muted">{shift.label.toLowerCase()}</span>{' '}
              {shift.after < shift.before ? 'dropped' : 'climbed'} from {shift.before} to{' '}
              <span className={shift.after < shift.before ? 'text-card-red' : 'text-mexico'}>
                {shift.after}
              </span>
              {index === 0 && ' — that’s most of the shift.'}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        {runs} seeded replays of each lineup pair (seed {monteCarlo.baseSeed}) — only the lineups
        differ. Rerunning changes the story above, never these numbers.
      </p>
    </div>
  )
}
