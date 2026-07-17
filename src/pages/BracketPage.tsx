import { motion } from 'framer-motion'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wordmark } from '../components/brand/Wordmark'
import { TeamFlag } from '../components/ui/TeamFlag'
import { BRACKET_ROUNDS, MATCHES, type LockedMatch, type MatchDef, type PlayedMatch } from '../data/matches'
import { TEAMS, type TeamInfo } from '../data/teams'
import { BTN_SECONDARY, FOCUS_RING } from '../ui/theme'

/** Seconds between each round's entrance. */
const ROUND_STAGGER = 0.4

const STAGE_SHORT: Record<string, string> = {
  'Round of 16': 'Round of 16',
  'Quarter-final': 'Quarter-finals',
  'Semi-final': 'Semi-finals',
  Final: 'Final',
}

/** Secondary node for the third-place play-off — deliberately quieter than the final. */
function ThirdPlaceCard({ match, delay }: { match: LockedMatch; delay: number }) {
  const home = match.homeTeamId ? TEAMS[match.homeTeamId] : null
  const away = match.awayTeamId ? TEAMS[match.awayTeamId] : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 24 }}
      className="w-full rounded-lg border border-dashed border-white/10 bg-night-2/30 px-2.5 py-2 opacity-70"
      aria-label={`Third-place play-off: ${home?.name ?? 'TBD'} vs ${away?.name ?? 'TBD'} — not played yet`}
    >
      <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted">
        <span>3rd place · {matchDateLabel(match.date)}</span>
        <span aria-hidden="true">🔒</span>
      </div>
      <div className="space-y-0.5">
        {[home, away].map((team, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-floodlight/60">
            <TeamFlag teamId={team?.id ?? null} className="h-2.5 shrink-0" title="" />
            <span className="truncate">{team?.name ?? 'To be decided'}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function matchDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

interface TeamRowProps {
  team: TeamInfo | null
  score: number | null
  isWinner: boolean
}

function TeamRow({ team, score, isWinner }: TeamRowProps) {
  return (
    <div className={`flex items-center gap-2 ${isWinner ? 'text-floodlight' : 'text-floodlight/60'}`}>
      <TeamFlag teamId={team?.id ?? null} className="h-3.5 shrink-0" title="" />
      <span className={`min-w-0 flex-1 truncate text-sm ${isWinner ? 'font-bold' : 'font-medium'}`}>
        {team ? team.name : 'To be decided'}
      </span>
      <span className={`font-display text-base font-black tabular-nums ${isWinner ? '' : 'text-muted'}`}>
        {score ?? '·'}
      </span>
    </div>
  )
}

function winnerSide(match: PlayedMatch): 'home' | 'away' {
  if (match.real.score.home !== match.real.score.away) {
    return match.real.score.home > match.real.score.away ? 'home' : 'away'
  }
  return match.real.pensWinner ?? 'home'
}

function PlayedCard({ match, delay }: { match: PlayedMatch; delay: number }) {
  const navigate = useNavigate()
  const home = TEAMS[match.home.teamId]
  const away = TEAMS[match.away.teamId]
  const winner = winnerSide(match)
  const winnerColor = TEAMS[match[winner].teamId].color

  return (
    <motion.button
      initial={{ opacity: 0, x: -26, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 24 }}
      whileHover={{ scale: 1.045, boxShadow: `0 0 0 1px ${winnerColor}88, 0 0 26px ${winnerColor}55` }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/match/${match.id}`)}
      className={`w-full cursor-pointer rounded-xl border border-white/12 bg-night-2/85 px-3 py-2.5 text-left shadow-lg shadow-black/40 backdrop-blur-sm transition-colors hover:border-white/30 ${FOCUS_RING}`}
      aria-label={`Replay ${home.name} vs ${away.name}`}
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
        <span>{matchDateLabel(match.date)}</span>
        <span className="flex gap-1">
          {match.real.decidedBy && (
            <span className="rounded border border-card-yellow/50 bg-card-yellow/10 px-1 py-0.5 text-card-yellow">
              {match.real.decidedBy}
            </span>
          )}
        </span>
      </div>
      <div className="space-y-1">
        <TeamRow team={home} score={match.real.score.home} isWinner={winner === 'home'} />
        <TeamRow team={away} score={match.real.score.away} isWinner={winner === 'away'} />
      </div>
    </motion.button>
  )
}

function LockedCard({ match, delay }: { match: MatchDef & { played: false }; delay: number }) {
  const home = match.homeTeamId ? TEAMS[match.homeTeamId] : null
  const away = match.awayTeamId ? TEAMS[match.awayTeamId] : null
  return (
    <motion.div
      initial={{ opacity: 0, x: -26, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 24 }}
      className="w-full rounded-xl border border-dashed border-white/10 bg-night-2/40 px-3 py-2.5 opacity-60"
      aria-label={`${home?.name ?? 'TBD'} vs ${away?.name ?? 'TBD'} — not played yet`}
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
        <span>{matchDateLabel(match.date)}</span>
        <span aria-hidden="true">🔒</span>
      </div>
      <div className="space-y-1">
        <TeamRow team={home} score={null} isWinner={false} />
        <TeamRow team={away} score={null} isWinner={false} />
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">Not played yet</div>
    </motion.div>
  )
}

/**
 * Elbow connector joining two feeder cards (at 25% and 75% of this cell's
 * height) to the next round's card (at 50%). Lines draw themselves in.
 * Before the final, two faint dashed tails also route the semi-final losers
 * down to the third-place node (sitting near the bottom of the final column).
 */
function Connector({ delay, thirdPlaceTails = false }: { delay: number; thirdPlaceTails?: boolean }) {
  const stroke = 'rgba(238,245,240,0.28)'
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      {['M 0 25 L 50 25 L 50 50', 'M 0 75 L 50 75 L 50 50', 'M 50 50 L 100 50'].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: delay + (i === 2 ? 0.22 : 0), duration: i === 2 ? 0.18 : 0.3, ease: 'easeInOut' }}
        />
      ))}
      {thirdPlaceTails &&
        ['M 0 25 C 30 25 70 88 100 88', 'M 0 75 C 40 75 70 88 100 88'].map((d, i) => (
          <motion.path
            key={`tail-${i}`}
            d={d}
            fill="none"
            stroke={stroke}
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.35, duration: 0.4, ease: 'easeInOut' }}
          />
        ))}
    </svg>
  )
}

function MatchCell({ matchId, delay }: { matchId: string; delay: number }) {
  const match = MATCHES[matchId]
  return match.played ? <PlayedCard match={match} delay={delay} /> : <LockedCard match={match} delay={delay} />
}

export function BracketPage() {
  // Column indices in the 7-column grid: cards at 1,3,5,7; connectors at 2,4,6.
  const rounds = BRACKET_ROUNDS

  // Mouse drag-to-pan for the horizontal scroll area (touch pans natively;
  // vertical scrolling belongs to the page).
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scroller.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
    // Dragging from a card would swallow its click; pan from the empty space.
    if ((e.target as HTMLElement).closest('button, a')) return
    drag.current = { x: e.clientX, left: el.scrollLeft }
    el.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scroller.current
    if (!el || !drag.current) return
    el.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = () => {
    drag.current = null
  }

  return (
    <main className="min-h-screen px-4 pb-6">
      <header className="mx-auto flex max-w-6xl flex-col gap-3 pb-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="shrink-0"
          >
            <Wordmark compact />
          </motion.div>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-2xl font-black uppercase tracking-tight text-floodlight sm:text-3xl"
            >
              The knockout <span className="bg-gradient-to-r from-mexico to-england bg-clip-text text-transparent">bracket</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-1 text-sm text-muted"
            >
              Tap any finished match to change its history.
            </motion.p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/how-it-works" className={`whitespace-nowrap px-4 py-2 ${BTN_SECONDARY}`}>
            How it works
          </Link>
          <Link to="/" className={`whitespace-nowrap px-4 py-2 ${BTN_SECONDARY}`}>
            ◂ Intro
          </Link>
        </div>
      </header>

      {/* Horizontal scroll area: the page handles vertical scrolling, so the
          footer notes sit naturally below the whole bracket. */}
      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="scroll-area cursor-grab overflow-x-auto pb-4 active:cursor-grabbing"
      >
        <div className="mx-auto min-w-[66rem] max-w-6xl px-2 pb-4 sm:px-4">
          {/* Column headers, aligned with the columns below. */}
          <div
            className="grid gap-x-0 py-2.5"
            style={{ gridTemplateColumns: 'minmax(0,1fr) 3.25rem minmax(0,1fr) 3.25rem minmax(0,1fr) 3.25rem minmax(0,1fr)' }}
          >
            {rounds.map((round, r) => (
              <motion.div
                key={round.stage}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: r * ROUND_STAGGER }}
                className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-muted"
                style={{ gridColumn: r * 2 + 1 }}
              >
                {STAGE_SHORT[round.stage]}
              </motion.div>
            ))}
          </div>

          {/* The tree. Base row height sets the R16 rhythm; later rounds span
              2/4/8 rows, so their breathing room doubles per round. Cards are
              flex-centered in their spans, keeping connector midpoints exact. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'minmax(0,1fr) 3.25rem minmax(0,1fr) 3.25rem minmax(0,1fr) 3.25rem minmax(0,1fr)',
              gridTemplateRows: 'repeat(8, minmax(7rem, auto))',
            }}
          >
            {rounds.map((round, r) =>
              round.matchIds.map((matchId, i) => {
                const span = 2 ** r
                const delay = r * ROUND_STAGGER + i * 0.07
                const isFinal = matchId === 'final'
                return (
                  <div
                    key={matchId}
                    className="relative flex items-center px-0.5 py-2"
                    style={{ gridColumn: r * 2 + 1, gridRow: `${i * span + 1} / span ${span}` }}
                  >
                    <MatchCell matchId={matchId} delay={delay} />
                    {/* The third-place play-off rides low in the final's column. */}
                    {isFinal && (
                      <div className="absolute inset-x-0.5 bottom-[3%]">
                        <ThirdPlaceCard
                          match={MATCHES['third-place'] as LockedMatch}
                          delay={delay + 0.35}
                        />
                      </div>
                    )}
                  </div>
                )
              }),
            )}

            {/* Connectors: one per next-round match, spanning its feeder pair. */}
            {rounds.slice(1).map((round, rNext) =>
              round.matchIds.map((matchId, i) => {
                const span = 2 ** (rNext + 1)
                return (
                  <div
                    key={`conn-${matchId}`}
                    style={{ gridColumn: rNext * 2 + 2, gridRow: `${i * span + 1} / span ${span}` }}
                  >
                    <Connector
                      delay={(rNext + 1) * ROUND_STAGGER + i * 0.07}
                      thirdPlaceTails={matchId === 'final'}
                    />
                  </div>
                )
              }),
            )}
          </div>
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="mx-auto mt-4 max-w-6xl text-center text-xs text-muted"
      >
        Locked cards haven't been played yet. Everything else is real — until you change it.
      </motion.p>
    </main>
  )
}
