import { motion } from 'framer-motion'
import type { TeamInfo } from '../../data/teams'
import type { SideStats } from '../../engine/types'
import { passAccuracy } from '../../services/playerRatings'
import { TeamFlag } from '../ui/TeamFlag'

interface StatsTableProps {
  home: TeamInfo
  away: TeamInfo
  stats: { home: SideStats; away: SideStats }
  /** Compact strip (four headline numbers) instead of the full table. */
  compact?: boolean
}

interface Row {
  label: string
  home: number
  away: number
  format?: (v: number) => string
  /** Lower is better (fouls, cards): the bar still shows share, the label stays neutral. */
  negative?: boolean
}

function rows(stats: { home: SideStats; away: SideStats }): Row[] {
  const pct = (s: SideStats) => passAccuracy(s) ?? 0
  return [
    { label: 'Possession', home: stats.home.possession, away: stats.away.possession, format: (v) => `${v}%` },
    { label: 'Shots', home: stats.home.shots, away: stats.away.shots },
    { label: 'On target', home: stats.home.onTarget, away: stats.away.onTarget },
    { label: 'Blocked', home: stats.home.blocked, away: stats.away.blocked },
    { label: 'Big chances', home: stats.home.bigChances, away: stats.away.bigChances },
    { label: 'Expected goals', home: stats.home.xg, away: stats.away.xg, format: (v) => v.toFixed(2) },
    { label: 'Corners', home: stats.home.corners, away: stats.away.corners },
    { label: 'Penalties', home: stats.home.penalties, away: stats.away.penalties },
    { label: 'Progressive passes', home: stats.home.passesCompleted, away: stats.away.passesCompleted },
    { label: 'Progression success', home: pct(stats.home), away: pct(stats.away), format: (v) => `${v}%` },
    { label: 'Fouls', home: stats.home.fouls, away: stats.away.fouls, negative: true },
    { label: 'Yellow cards', home: stats.home.yellows, away: stats.away.yellows, negative: true },
    { label: 'Red cards', home: stats.home.reds, away: stats.away.reds, negative: true },
  ]
}

const HEADLINE = new Set(['Possession', 'Shots', 'Expected goals', 'Big chances'])

/**
 * The classic broadcast stats panel: every number the engine tracked for
 * each side, with a split bar showing the share so the shape of the game
 * reads at a glance.
 */
export function StatsTable({ home, away, stats, compact = false }: StatsTableProps) {
  const all = rows(stats)
  const shown = compact ? all.filter((r) => HEADLINE.has(r.label)) : all
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
        <span className="flex items-center gap-1.5" style={{ color: home.color }}>
          <TeamFlag teamId={home.id} className="h-3" title="" /> {home.shortName}
        </span>
        <span className="flex items-center gap-1.5" style={{ color: away.color }}>
          {away.shortName} <TeamFlag teamId={away.id} className="h-3" title="" />
        </span>
      </div>
      <ul className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {shown.map((row, i) => {
          const total = row.home + row.away
          const homeShare = total > 0 ? row.home / total : 0.5
          const fmt = row.format ?? ((v: number) => String(v))
          const homeLeads = row.home > row.away
          const awayLeads = row.away > row.home
          const strong = (leads: boolean) => (leads && !row.negative ? 'text-floodlight' : 'text-floodlight/70')
          return (
            <li key={row.label} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 text-sm tabular-nums">
              <span className={`text-right font-display text-base font-black ${strong(homeLeads)}`}>{fmt(row.home)}</span>
              <div>
                <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-muted">{row.label}</div>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-ink/8" aria-hidden="true">
                  <motion.div
                    className="h-full rounded-l-full"
                    style={{ background: home.chartColor, opacity: row.negative ? 0.5 : 1 }}
                    initial={{ width: '50%' }}
                    animate={{ width: `${homeShare * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22, delay: i * 0.03 }}
                  />
                  <div className="h-full flex-1 rounded-r-full" style={{ background: away.chartColor, opacity: row.negative ? 0.5 : 1 }} />
                </div>
              </div>
              <span className={`font-display text-base font-black ${strong(awayLeads)}`}>{fmt(row.away)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
