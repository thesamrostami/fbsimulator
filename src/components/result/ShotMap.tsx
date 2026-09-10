import { useMemo, useState } from 'react'
import type { TeamInfo } from '../../data/teams'
import { isShotEvent, type MatchEvent, type Side } from '../../engine/types'
import { TeamFlag } from '../ui/TeamFlag'

/**
 * Post-match shot map: every attempt at its real engine spot, sized by xG.
 * Home attacks the right-hand goal, away the left, whatever ends they
 * played toward in each half — a shot map is about the goal, not the pitch
 * end. Hover a bubble for the minute, player, xG and what happened.
 */

const W = 640
const H = 420
const PAD = 20
const PW = W - 2 * PAD
const PH = H - 2 * PAD
const INK = 'color-mix(in srgb, var(--color-pitch-mark) 55%, transparent)'

type Outcome = 'goal' | 'saved' | 'blocked' | 'miss'

interface Bubble {
  key: string
  x: number
  y: number
  r: number
  side: Side
  outcome: Outcome
  event: MatchEvent
}

function outcomeOf(e: MatchEvent): Outcome {
  return e.type === 'goal' ? 'goal' : e.type === 'shot-saved' ? 'saved' : e.type === 'shot-blocked' ? 'blocked' : 'miss'
}

const OUTCOME_LABEL: Record<Outcome, string> = { goal: 'Goal', saved: 'Saved', blocked: 'Blocked', miss: 'Off target' }

function Markings() {
  const box = { w: PW * (16.5 / 105), h: PH * (40.32 / 68) }
  const six = { w: PW * (5.5 / 105), h: PH * (18.32 / 68) }
  const cy = PAD + PH / 2
  const r = PH * (9.15 / 68)
  return (
    <g fill="none" stroke={INK} strokeWidth="1.5">
      <rect x={PAD} y={PAD} width={PW} height={PH} rx="2" />
      <line x1={W / 2} y1={PAD} x2={W / 2} y2={PAD + PH} />
      <circle cx={W / 2} cy={cy} r={r} />
      {[-1, 1].map((end) => {
        const goalX = end < 0 ? PAD : W - PAD
        const dir = end < 0 ? 1 : -1
        const bx = end < 0 ? goalX : goalX - box.w
        const sx = end < 0 ? goalX : goalX - six.w
        const spot = goalX + dir * PW * (11 / 105)
        return (
          <g key={end}>
            <rect x={bx} y={cy - box.h / 2} width={box.w} height={box.h} />
            <rect x={sx} y={cy - six.h / 2} width={six.w} height={six.h} />
            <circle cx={spot} cy={cy} r="1.8" fill={INK} stroke="none" />
            <path
              d={`M ${goalX + dir * box.w} ${cy - PH * 0.12} A ${r} ${r} 0 0 ${end < 0 ? 1 : 0} ${goalX + dir * box.w} ${cy + PH * 0.12}`}
            />
            <rect x={end < 0 ? goalX - 8 : goalX} y={cy - PH * (3.66 / 68)} width="8" height={PH * (7.32 / 68)} stroke={INK} />
          </g>
        )
      })}
    </g>
  )
}

interface ShotMapProps {
  events: MatchEvent[]
  home: TeamInfo
  away: TeamInfo
}

export function ShotMap({ events, home, away }: ShotMapProps) {
  const [hover, setHover] = useState<Bubble | null>(null)
  const bubbles = useMemo<Bubble[]>(
    () =>
      events
        .filter((e) => isShotEvent(e) && e.spot && e.side)
        .map((e, i) => {
          const side = e.side as Side
          // Home attacks right: x grows toward the right goal. Away is mirrored.
          const fx = side === 'home' ? e.spot!.x : 1 - e.spot!.x
          const fy = side === 'home' ? e.spot!.y : 1 - e.spot!.y
          return {
            key: `${e.minute}-${i}`,
            x: PAD + fx * PW,
            y: PAD + fy * PH,
            r: 4 + Math.sqrt(e.xg ?? 0) * 18,
            side,
            outcome: outcomeOf(e),
            event: e,
          }
        }),
    [events],
  )
  const teamOf = (side: Side) => (side === 'home' ? home : away)
  const tooltipLeft = hover ? hover.x > W * 0.6 : false

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-floodlight/80">
        <span className="flex items-center gap-1.5">
          <TeamFlag teamId={home.id} className="h-3" title="" /> {home.shortName} ▸
        </span>
        <span className="flex items-center gap-1.5">
          ◂ {away.shortName} <TeamFlag teamId={away.id} className="h-3" title="" />
        </span>
        <span className="ml-auto flex items-center gap-3 font-normal text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-floodlight bg-muted" /> goal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-muted/60" /> saved
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border border-muted bg-transparent" /> blocked / off
          </span>
          <span>size = xG</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ background: 'linear-gradient(90deg, var(--color-pitch), var(--color-pitch-2), var(--color-pitch))' }}
        role="img"
        aria-label={`Shot map: ${bubbles.length} attempts`}
        onMouseLeave={() => setHover(null)}
      >
        <Markings />
        {bubbles.map((b) => {
          const color = teamOf(b.side).color
          const filled = b.outcome === 'goal' || b.outcome === 'saved'
          return (
            <circle
              key={b.key}
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill={filled ? color : 'transparent'}
              fillOpacity={b.outcome === 'goal' ? 1 : 0.55}
              stroke={b.outcome === 'goal' ? 'var(--color-floodlight)' : color}
              strokeWidth={b.outcome === 'goal' ? 2.5 : 1.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(b)}
              onFocus={() => setHover(b)}
              tabIndex={0}
              aria-label={`${b.event.minute}' ${b.event.player?.name ?? ''} ${OUTCOME_LABEL[b.outcome]} xG ${(b.event.xg ?? 0).toFixed(2)}`}
            />
          )
        })}
        {hover && (
          <g pointerEvents="none" transform={`translate(${hover.x + (tooltipLeft ? -178 : 14)}, ${Math.min(hover.y - 12, H - 74)})`}>
            <rect width="164" height="62" rx="6" fill="var(--color-night-2)" stroke="color-mix(in srgb, var(--color-ink) 18%, transparent)" />
            <text x="10" y="18" fontSize="11" fontWeight="700" fill="var(--color-floodlight)">
              {hover.event.minute}&#8242; {hover.event.player?.name ?? ''}
            </text>
            <text x="10" y="34" fontSize="10" fill="var(--color-muted)">
              {OUTCOME_LABEL[hover.outcome]} · xG {(hover.event.xg ?? 0).toFixed(2)}
              {hover.event.header ? ' · header' : ''}
            </text>
            <text x="10" y="50" fontSize="10" fill="var(--color-muted)">
              {hover.event.source === 'open-play' ? 'Open play' : hover.event.source === 'counter' ? 'Fast break' : hover.event.source === 'corner' ? 'From a corner' : hover.event.source === 'free-kick' ? 'Free kick' : 'Penalty'}
              {hover.event.assist ? ` · from ${hover.event.assist.name}` : ''}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
