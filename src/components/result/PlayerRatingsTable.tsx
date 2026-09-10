import { useState } from 'react'
import type { TeamInfo } from '../../data/teams'
import type { MatchRatings, PlayerRating } from '../../services/playerRatings'
import { FOCUS_RING } from '../../ui/theme'
import { TeamFlag } from '../ui/TeamFlag'

/**
 * Per-player match ratings for both teams, one team at a time, with the
 * Man of the Match called out. Every column is an engine-tracked number.
 */

function ratingTone(rating: number): string {
  if (rating >= 8) return 'bg-mexico/20 text-mexico border-mexico/40'
  if (rating >= 7) return 'bg-gold/15 text-gold border-gold/40'
  if (rating >= 6) return 'bg-ink/8 text-floodlight border-ink/15'
  return 'bg-card-red/15 text-card-red border-card-red/40'
}

export function RatingBadge({ rating, large = false }: { rating: number; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-display font-black tabular-nums ${ratingTone(rating)} ${
        large ? 'h-10 min-w-[3.25rem] px-2 text-xl' : 'h-7 min-w-[2.5rem] px-1.5 text-sm'
      }`}
    >
      {rating.toFixed(1)}
    </span>
  )
}

function Row({ p, motm, accent }: { p: PlayerRating; motm: boolean; accent: string }) {
  const s = p.stats
  const cards = s.red ? '🟥' : s.yellows > 0 ? '🟨' : ''
  return (
    <tr className={`border-t border-ink/8 ${motm ? 'bg-gold/5' : ''}`}>
      <td className="py-1.5 pr-2">
        <div className="flex items-center gap-2">
          <span className="w-6 text-right font-display text-sm font-black tabular-nums" style={{ color: accent }}>
            {p.shirtNumber}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-floodlight">
              {p.name}
              {motm && <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-gold">★ MOTM</span>}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
              {p.label} · {p.minutes}&#8242;{cards && <span className="ml-1">{cards}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="py-1.5 text-center">
        <RatingBadge rating={p.rating} />
      </td>
      <td className="py-1.5 text-center tabular-nums">{s.goals || '·'}</td>
      <td className="py-1.5 text-center tabular-nums">{s.assists || '·'}</td>
      <td className="py-1.5 text-center tabular-nums">
        {s.shots ? (
          <>
            {s.shots}
            <span className="text-muted"> ({s.onTarget})</span>
          </>
        ) : (
          '·'
        )}
      </td>
      <td className="py-1.5 text-center tabular-nums">{s.xg ? s.xg.toFixed(2) : '·'}</td>
      <td className="py-1.5 text-center tabular-nums">{s.keyPasses || '·'}</td>
      <td className="py-1.5 text-center tabular-nums">
        {s.passes ? (
          <>
            {s.passesCompleted}
            <span className="text-muted">/{s.passes}</span>
          </>
        ) : (
          '·'
        )}
      </td>
      <td className="py-1.5 text-center tabular-nums">{s.tackles || '·'}</td>
      <td className="py-1.5 text-center tabular-nums">
        {p.line === 'GK' ? (
          s.saves ? (
            <>
              {s.saves}
              <span className="text-muted"> sv</span>
            </>
          ) : (
            '·'
          )
        ) : (
          s.fouls || '·'
        )}
      </td>
    </tr>
  )
}

interface PlayerRatingsTableProps {
  ratings: MatchRatings
  home: TeamInfo
  away: TeamInfo
}

export function PlayerRatingsTable({ ratings, home, away }: PlayerRatingsTableProps) {
  // Open on the man of the match's team.
  const [side, setSide] = useState<'home' | 'away'>(ratings.motm?.side ?? 'home')
  const team = side === 'home' ? home : away
  const rows = ratings[side]
  return (
    <div>
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Team ratings">
        {(['home', 'away'] as const).map((key) => {
          const t = key === 'home' ? home : away
          const active = side === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setSide(key)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${FOCUS_RING} ${
                active ? 'border-ink/25 text-floodlight' : 'border-ink/10 text-muted hover:text-floodlight'
              }`}
              style={active ? { boxShadow: `inset 0 -2px 0 ${t.color}` } : undefined}
            >
              <TeamFlag teamId={t.id} className="h-3" title="" /> {t.shortName}
            </button>
          )
        })}
      </div>
      <div className="scroll-area overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-sm" data-testid="ratings-table">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-widest text-muted">
              <th className="pb-2 text-left font-bold">Player</th>
              <th className="pb-2 font-bold">Rating</th>
              <th className="pb-2 font-bold" title="Goals">G</th>
              <th className="pb-2 font-bold" title="Assists">A</th>
              <th className="pb-2 font-bold" title="Shots (on target)">Shots</th>
              <th className="pb-2 font-bold" title="Expected goals">xG</th>
              <th className="pb-2 font-bold" title="Key passes: passes that led to a shot">KP</th>
              <th className="pb-2 font-bold" title="Progressive passes completed / attempted">Passes</th>
              <th className="pb-2 font-bold" title="Tackles, interceptions and blocks">Tkl</th>
              <th className="pb-2 font-bold" title="Fouls committed; saves (sv) for the keeper">Fouls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Row key={p.playerId} p={p} motm={ratings.motm?.playerId === p.playerId} accent={team.color} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        Ratings are computed from the engine's own per-player numbers (goals, assists, chance quality, progression,
        defensive actions, saves, discipline) on the familiar 4–10 scale. Passes are the progressive passes the
        possession engine plays, not every touch.
      </p>
    </div>
  )
}
