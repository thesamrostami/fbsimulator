import { motion } from 'framer-motion'
import type { TeamInfo } from '../../data/teams'
import type { MonteCarloResult } from '../../engine/types'
import { NEUTRAL_MARK } from '../../ui/theme'

interface ProbabilityBarsProps {
  monteCarlo: MonteCarloResult
  home: TeamInfo
  away: TeamInfo
}

/**
 * Win/draw/loss split from the 1,000-run Monte Carlo, as animated horizontal
 * bars. Colors follow the entity (team hue, neutral gray for the draw); values
 * are direct-labeled in ink. In knockout mode every replay is decided, so the
 * draw row disappears and the ET/shootout shares are footnoted.
 */
export function ProbabilityBars({ monteCarlo, home, away }: ProbabilityBarsProps) {
  const knockout = monteCarlo.extraTimePct !== undefined
  const rows = [
    { label: `${home.name} win`, pct: monteCarlo.homeWinPct, color: home.chartColor },
    ...(knockout ? [] : [{ label: 'Draw', pct: monteCarlo.drawPct, color: NEUTRAL_MARK }]),
    { label: `${away.name} win`, pct: monteCarlo.awayWinPct, color: away.chartColor },
  ]
  const runs = monteCarlo.runs.toLocaleString('en-US')

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex items-center gap-3"
            title={`${row.label}: ${row.pct}% of ${runs} replays`}
          >
            <span className="w-28 shrink-0 text-sm font-semibold text-floodlight/85">{row.label}</span>
            <div className="h-3.5 flex-1 rounded-sm bg-ink/5">
              <motion.div
                className="h-full"
                style={{ background: row.color, borderRadius: '0 4px 4px 0' }}
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.15 + index * 0.12 }}
              />
            </div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.12 }}
              className="w-14 text-right font-display text-base font-black tabular-nums text-floodlight"
            >
              {row.pct.toFixed(1)}%
            </motion.span>
          </div>
        ))}
      </div>

      {knockout && (
        <p className="mt-3 text-xs text-muted">
          {monteCarlo.extraTimePct?.toFixed(1)}% of replays needed extra time;{' '}
          {monteCarlo.shootoutPct?.toFixed(1)}% went to penalties.
        </p>
      )}

      <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-muted">
        Most common scorelines
      </h3>
      <div className="space-y-2">
        {monteCarlo.topScorelines.slice(0, 3).map((line, index) => {
          const pct = (line.count / monteCarlo.runs) * 100
          return (
            <div
              key={`${line.home}-${line.away}`}
              className="flex items-center gap-3"
              title={`${line.count} of ${runs} replays`}
            >
              <span className="w-28 shrink-0 text-sm tabular-nums text-floodlight/85">
                {home.shortName} {line.home}–{line.away} {away.shortName}
              </span>
              <div className="h-2.5 flex-1 rounded-sm bg-ink/5">
                <motion.div
                  className="h-full"
                  style={{ background: NEUTRAL_MARK, borderRadius: '0 4px 4px 0' }}
                  initial={{ width: 0 }}
                  // Scale to the most common line so relative frequency is readable.
                  animate={{ width: `${(line.count / monteCarlo.topScorelines[0].count) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.6 + index * 0.1 }}
                />
              </div>
              <span className="w-14 text-right text-sm tabular-nums text-muted">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-muted">
        {runs} seeded replays of your lineups (seed {monteCarlo.baseSeed}).
      </p>
    </div>
  )
}
