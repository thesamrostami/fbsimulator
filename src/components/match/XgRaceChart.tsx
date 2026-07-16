import { useMemo, useState, type MouseEvent } from 'react'
import type { MatchEvent, XgTimelinePoint } from '../../engine/types'

interface XgRaceChartProps {
  timeline: XgTimelinePoint[]
  /** Playhead: only minutes up to here are drawn, so the chart draws itself. */
  minute: number
  goals: MatchEvent[]
  homeName: string
  awayName: string
  homeColor: string
  awayColor: string
  /** 90, or 120 when the match went to extra time. */
  maxMinute: number
}

const W = 560
const H = 250
const ML = 40
const MR = 64
const MT = 14
const MB = 30
const PLOT_W = W - ML - MR
const PLOT_H = H - MT - MB

const INK = 'rgba(238,245,240,0.87)'
const INK_MUTED = 'rgba(238,245,240,0.55)'
const GRID = 'rgba(238,245,240,0.08)'
const SURFACE = '#081a10'

export function XgRaceChart({ timeline, minute, goals, homeName, awayName, homeColor, awayColor, maxMinute }: XgRaceChartProps) {
  const [hoverMinute, setHoverMinute] = useState<number | null>(null)

  // Stable y-scale across the whole match so the axis never rescales mid-draw.
  const yMax = useMemo(() => {
    const last = timeline[timeline.length - 1]
    const peak = last ? Math.max(last.home, last.away) : 1
    return Math.max(1, Math.ceil(peak * 2) / 2)
  }, [timeline])

  const visibleCount = Math.min(Math.floor(minute), timeline.length)
  const visible = timeline.slice(0, visibleCount)

  const x = (min: number) => ML + (min / maxMinute) * PLOT_W
  const y = (xg: number) => MT + PLOT_H - (xg / yMax) * PLOT_H

  const linePoints = (key: 'home' | 'away') =>
    [`${x(0)},${y(0)}`, ...visible.map((point) => `${x(point.minute)},${y(point[key])}`)].join(' ')

  const last = visible[visible.length - 1]
  // Push the two end labels apart if the lines finish close together.
  let endLabels: { yHome: number; yAway: number } | null = null
  if (last) {
    let yHome = y(last.home)
    let yAway = y(last.away)
    if (Math.abs(yHome - yAway) < 14) {
      const mid = (yHome + yAway) / 2
      const homeOnTop = yHome <= yAway
      yHome = homeOnTop ? mid - 7 : mid + 7
      yAway = homeOnTop ? mid + 7 : mid - 7
    }
    endLabels = { yHome, yAway }
  }

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    if (visibleCount === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xVb = ((e.clientX - rect.left) / rect.width) * W
    const min = Math.round(((xVb - ML) / PLOT_W) * maxMinute)
    setHoverMinute(Math.min(Math.max(min, 1), visibleCount))
  }

  const hoverPoint = hoverMinute !== null ? timeline[hoverMinute - 1] : undefined
  const tooltipOnLeft = hoverPoint !== undefined && x(hoverPoint.minute) > W - MR - 120

  const gridSteps = useMemo(() => {
    const steps: number[] = []
    for (let v = 0; v <= yMax + 1e-9; v += 0.5) steps.push(Math.round(v * 2) / 2)
    return steps
  }, [yMax])

  const minuteTicks = useMemo(() => {
    const ticks: number[] = []
    for (let min = 0; min <= maxMinute; min += 15) ticks.push(min)
    return ticks
  }, [maxMinute])

  return (
    <div>
      {/* Legend: identity never by color alone — swatch + name in ink. */}
      <div className="mb-2 flex items-center gap-5 text-xs font-semibold text-floodlight/80">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: homeColor }} />
          {homeName}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: awayColor }} />
          {awayName}
        </span>
        <span className="ml-auto font-normal text-muted">cumulative xG</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Cumulative expected goals race between ${homeName} and ${awayName}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverMinute(null)}
      >
        {/* recessive grid + axis labels */}
        {gridSteps.map((v) => (
          <g key={v}>
            <line x1={ML} y1={y(v)} x2={W - MR} y2={y(v)} stroke={GRID} strokeWidth="1" />
            <text x={ML - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={INK_MUTED}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {minuteTicks.map((min) => (
          <text key={min} x={x(min)} y={H - 10} textAnchor="middle" fontSize="10" fill={INK_MUTED}>
            {min}&#8242;
          </text>
        ))}
        <line x1={ML} y1={MT + PLOT_H} x2={W - MR} y2={MT + PLOT_H} stroke={INK_MUTED} strokeWidth="1" />
        {/* extra-time boundary */}
        {maxMinute > 90 && (
          <line x1={x(90)} y1={MT} x2={x(90)} y2={MT + PLOT_H} stroke={INK_MUTED} strokeWidth="1" strokeDasharray="4 4" />
        )}

        {/* the race */}
        <polyline
          points={linePoints('home')}
          fill="none"
          stroke={homeColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={linePoints('away')}
          fill="none"
          stroke={awayColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* goal markers: 2px surface ring so they read on top of the lines */}
        {goals
          .filter((goal) => goal.minute <= visibleCount)
          .map((goal, i) => {
            const point = timeline[Math.min(goal.minute, timeline.length) - 1]
            if (!point) return null
            const isHome = goal.side === 'home'
            return (
              <circle
                key={`${goal.minute}-${i}`}
                cx={x(goal.minute)}
                cy={y(isHome ? point.home : point.away)}
                r="4.5"
                fill={isHome ? homeColor : awayColor}
                stroke={SURFACE}
                strokeWidth="2"
              />
            )
          })}

        {/* direct labels at the line ends */}
        {last && endLabels && (
          <g fontSize="11" fontWeight="700" fill={INK}>
            <text x={x(last.minute) + 8} y={endLabels.yHome + 4}>
              {homeName} {last.home.toFixed(2)}
            </text>
            <text x={x(last.minute) + 8} y={endLabels.yAway + 4}>
              {awayName} {last.away.toFixed(2)}
            </text>
          </g>
        )}

        {/* hover crosshair + tooltip */}
        {hoverPoint && (
          <g pointerEvents="none">
            <line
              x1={x(hoverPoint.minute)}
              y1={MT}
              x2={x(hoverPoint.minute)}
              y2={MT + PLOT_H}
              stroke={INK_MUTED}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={x(hoverPoint.minute)} cy={y(hoverPoint.home)} r="3.5" fill={homeColor} stroke={SURFACE} strokeWidth="2" />
            <circle cx={x(hoverPoint.minute)} cy={y(hoverPoint.away)} r="3.5" fill={awayColor} stroke={SURFACE} strokeWidth="2" />
            <g transform={`translate(${x(hoverPoint.minute) + (tooltipOnLeft ? -118 : 10)}, ${MT + 6})`}>
              <rect width="108" height="52" rx="6" fill="#0c2013" stroke="rgba(238,245,240,0.18)" />
              <text x="10" y="16" fontSize="10" fontWeight="700" fill={INK}>
                {hoverPoint.minute}&#8242;
              </text>
              <text x="10" y="30" fontSize="10" fill={INK}>
                <tspan fill={homeColor}>●</tspan> {homeName} {hoverPoint.home.toFixed(2)}
              </text>
              <text x="10" y="44" fontSize="10" fill={INK}>
                <tspan fill={awayColor}>●</tspan> {awayName} {hoverPoint.away.toFixed(2)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
