import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { teamHex, type TeamInfo } from '../../data/teams'
import type { LineupSnapshot, MatchEvent, MomentumTimelinePoint, PossessionSequence } from '../../engine/types'
import { FOCUS_RING } from '../../ui/theme'
import { useTheme } from '../../ui/themeState'
import { liveLine } from './livePitchModel'

// three.js is heavy; both views live in lazy chunks so the 2D pages stay light.
const LivePitch = lazy(() => import('./LivePitch').then((m) => ({ default: m.LivePitch })))
const MomentumTerrain = lazy(() => import('./MomentumTerrain').then((m) => ({ default: m.MomentumTerrain })))

type View = 'live' | 'terrain'

export interface MatchStageProps {
  sequences: PossessionSequence[]
  events: MatchEvent[]
  lineupLog: LineupSnapshot[]
  momentumTimeline: MomentumTimelinePoint[]
  /** Playhead, fractional minutes. */
  minute: number
  duration: number
  home: TeamInfo
  away: TeamInfo
  reducedMotion: boolean
  /** Turntable for the finished-match replay. */
  autoRotate?: boolean
  /** Compact heading (result page) vs the full live heading. */
  title?: string
  className?: string
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-ink/12 bg-night/40 p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${FOCUS_RING} ${
              active ? 'bg-ink/12 text-floodlight' : 'text-muted hover:text-floodlight'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The 3D stage of the match screen and the result replay: the live pitch
 * (players + ball, default) or the territory terrain, with the shot-map
 * overlay and a focus strip for whichever player is hovered or pinned.
 */
export function MatchStage({
  sequences,
  events,
  lineupLog,
  momentumTimeline,
  minute,
  duration,
  home,
  away,
  reducedMotion,
  autoRotate = false,
  title = 'Live pitch',
  className = '',
}: MatchStageProps) {
  const { theme } = useTheme()
  const [view, setView] = useState<View>('live')
  const [shotMap, setShotMap] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const onSelect = useCallback((id: string | null) => setFocus(id), [])
  const onHover = useCallback((id: string | null) => setHovered(id), [])

  const spotlightId = hovered ?? focus
  const shownMinute = Math.floor(minute)
  const spotlight = useMemo(() => {
    if (!spotlightId) return null
    for (const side of ['home', 'away'] as const) {
      for (const snapshot of lineupLog) {
        const entry = snapshot[side].find((p) => p.playerId === spotlightId)
        if (entry) return { entry, side, team: side === 'home' ? home : away }
      }
    }
    return null
  }, [spotlightId, lineupLog, home, away])
  const line = useMemo(
    () => (spotlightId ? liveLine(spotlightId, events, sequences, shownMinute) : null),
    [spotlightId, events, sequences, shownMinute],
  )

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-ink/10 bg-night-2/50 ${className}`}
      style={{
        background:
          'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--color-brand-b) 8%, transparent), color-mix(in srgb, var(--color-brand-a) 5%, transparent) 45%, transparent 72%)',
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 sm:px-5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">{title}</span>
        <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-floodlight/70">3D</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Pitch view"
            value={view}
            onChange={setView}
            options={[
              { value: 'live', label: 'Players' },
              { value: 'terrain', label: 'Territory' },
            ]}
          />
          {view === 'live' && (
            <button
              type="button"
              aria-pressed={shotMap}
              onClick={() => setShotMap((v) => !v)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${FOCUS_RING} ${
                shotMap ? 'border-gold/50 bg-gold/10 text-gold' : 'border-ink/12 text-muted hover:text-floodlight'
              }`}
            >
              Shot map
            </button>
          )}
        </div>
      </div>

      <div className="h-[24rem] w-full sm:h-[30rem]">
        <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted">Loading pitch…</div>}>
          {view === 'live' ? (
            <LivePitch
              sequences={sequences}
              events={events}
              lineupLog={lineupLog}
              minute={minute}
              duration={duration}
              home={home}
              away={away}
              reducedMotion={reducedMotion}
              autoRotate={autoRotate}
              showShotMap={shotMap}
              focus={focus}
              onSelect={onSelect}
              onHover={onHover}
            />
          ) : (
            <MomentumTerrain
              momentumTimeline={momentumTimeline}
              events={events}
              minute={minute}
              homeColor={teamHex(home.id, theme).accent}
              awayColor={teamHex(away.id, theme).accent}
              homeName={home.shortName}
              awayName={away.shortName}
              duration={duration}
              reducedMotion={reducedMotion}
              autoRotate={autoRotate}
            />
          )}
        </Suspense>
      </div>

      {/* Focus strip: the hovered / pinned player's live line. */}
      <div className="min-h-[2.75rem] border-t border-ink/8 px-4 py-2 text-xs sm:px-5">
        {spotlight && line ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-display text-base font-black tabular-nums" style={{ color: spotlight.team.color }}>
              {spotlight.entry.shirtNumber}
            </span>
            <span className="font-semibold text-floodlight">{spotlight.entry.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
              {spotlight.team.shortName} · {spotlight.entry.label}
            </span>
            <span className="ml-auto flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted">
              <span>
                Shots <b className="text-floodlight">{line.shots}</b>
              </span>
              <span>
                xG <b className="text-floodlight">{line.xg.toFixed(2)}</b>
              </span>
              <span>
                Goals <b className="text-floodlight">{line.goals}</b>
              </span>
              <span>
                Assists <b className="text-floodlight">{line.assists}</b>
              </span>
              <span>
                Passes <b className="text-floodlight">{line.passes}</b>
              </span>
              {line.red ? <span className="text-card-red">🟥 sent off</span> : line.yellow ? <span className="text-gold">🟨 booked</span> : null}
              {focus === spotlightId && (
                <button type="button" onClick={() => setFocus(null)} className={`text-muted underline underline-offset-2 hover:text-floodlight ${FOCUS_RING}`}>
                  unpin
                </button>
              )}
            </span>
          </div>
        ) : (
          <p className="text-[11px] leading-snug text-muted">
            {view === 'live'
              ? 'Hover or tap a player for his live numbers; tap again to unpin. Drag to orbit, scroll to zoom. Every pass and shot is the engine’s own possession data — teams switch ends at half-time.'
              : 'Two coloured sheets share the pitch; the line where they meet is the territory the teams push back and forth, peaks rise where shots happened.'}{' '}
            <Link to="/how-it-works" className="underline underline-offset-2 hover:text-floodlight">
              How it works
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
