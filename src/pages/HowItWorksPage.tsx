import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SourceBadge } from '../components/ui/SourceBadge'
import { FORMATIONS } from '../data/formations'
import { PLAYER_RATINGS_META } from '../data/players'
import { TEAM_STRENGTH_META } from '../data/teamStrength'
import { CALIBRATION_META, CONVERSION_SAMPLE, SHOOTOUT_BASE_CONVERSION } from '../engine/empirical'
import { MONTE_CARLO_RUNS } from '../services/simulation'
import { BTN_SECONDARY, FOCUS_RING, LABEL } from '../ui/theme'

function Section({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="rounded-2xl border border-white/10 bg-night-2/70 p-6"
    >
      <h2 className="mb-3 flex flex-wrap items-center gap-3 font-display text-lg font-black uppercase tracking-widest text-floodlight">
        {title}
        {badge}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-floodlight/85">{children}</div>
    </motion.section>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-area overflow-x-auto rounded-lg border border-white/10 bg-night p-4 font-mono text-xs leading-loose text-floodlight/90">
      {children}
    </div>
  )
}

export function HowItWorksPage() {
  return (
    <main className="min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 pb-8 pt-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-2xl font-black uppercase tracking-tight text-floodlight sm:text-3xl"
          >
            How the <span className="bg-gradient-to-r from-mexico to-england bg-clip-text text-transparent">engine</span> works
          </motion.h1>
          <p className="mt-1 text-sm text-muted">No black box: what's real, what's estimated, and the actual math.</p>
        </div>
        <Link to="/bracket" className={`shrink-0 whitespace-nowrap px-4 py-2 ${BTN_SECONDARY}`}>
          ◂ Bracket
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-5">
        <Section title="What's real" badge={<SourceBadge kind="real" />}>
          <p>
            Everything factual about the 16 played matches comes from the public match records of the 2026 World Cup:
            the <strong>results and scorelines</strong>, <strong>goal minutes</strong>, <strong>cards</strong>,{' '}
            <strong>starting lineups and 26-man squads</strong> (verified against multiple sources),{' '}
            <strong>formations</strong>, <strong>possession splits</strong> and <strong>shot counts</strong>.
            And since v4, each team's <strong>baseline strength is fitted on real international results</strong> —
            see the data sources below. The bracket is complete, through the third-place play-off and the final.
          </p>
        </Section>

        <Section title="Data & sources">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>International results, 1872–2026</strong> —{' '}
              <a
                href="https://github.com/martj42/international_results"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline underline-offset-2 transition-colors hover:text-floodlight"
              >
                github.com/martj42/international_results
              </a>{' '}
              (public-domain/CC0 dataset; retrieved {TEAM_STRENGTH_META.retrievedAt}). Contributes: the fitted team-strength
              model ({TEAM_STRENGTH_META.matchesUsed.toLocaleString('en-US')} matches from the last ~4 years),
              the empirical goal-minute distribution ({CALIBRATION_META.goalsUsed.toLocaleString('en-US')}{' '}
              goals), and the shootout record.
            </li>
            <li>
              <strong>StatsBomb Open Data</strong> —{' '}
              <a
                href="https://github.com/statsbomb/open-data"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline underline-offset-2 transition-colors hover:text-floodlight"
              >
                github.com/statsbomb/open-data
              </a>{' '}
              (data © StatsBomb, used with credit under their open-data licence; retrieved{' '}
              {CALIBRATION_META.retrievedAt}). Contributes:
              shot-conversion calibration from the World Cup 2022 knockout stage
              {CONVERSION_SAMPLE ? ` (${CONVERSION_SAMPLE.sample.shots} shots across ${CONVERSION_SAMPLE.sample.matches} matches)` : ''}.
            </li>
            <li>
              <strong>EA SPORTS FC 26 player ratings</strong> —{' '}
              <a
                href="https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline underline-offset-2 transition-colors hover:text-floodlight"
              >
                unofficial community extract via Kaggle (credit: rovnez)
              </a>
              , retrieved {PLAYER_RATINGS_META.retrievedAt}. {PLAYER_RATINGS_META.matched} of{' '}
              {PLAYER_RATINGS_META.rosterSize} squad players are matched by normalized, country-constrained
              fuzzy name matching (every match and rejection is listed in the pipeline's matching report);
              matched players carry the <SourceBadge kind="fc26" short /> badge. The remaining{' '}
              {PLAYER_RATINGS_META.unmatched} — mostly leagues absent from FC 26 — keep editorial estimates
              marked <SourceBadge kind="estimated" short />. FC 26 numbers are a video game's editorial view
              of ability, not official statistics.
            </li>
          </ul>
          <p>
            <strong>Design inspiration.</strong> The match visualization takes its cue from Alexander
            Bogachev's{' '}
            <a
              href="https://wc26.bogachev.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted underline underline-offset-2 transition-colors hover:text-floodlight"
            >
              FIFA World Cup 2026 Data Portraits
            </a>{' '}
            — turning raw match events into a living, almost topographical visual field. Ours isn't the
            same build, but his work is the reason we reached for that feeling instead of a flat timeline.
          </p>
        </Section>

        <Section title="The team-strength model">
          <p>
            Every national team gets an <strong>attack</strong> and <strong>defence</strong> parameter fitted
            with a Dixon-Coles-style weighted Poisson model on real internationals: each match contributes
            two goal counts with rate log λ = μ + attack − opposing defence (+ home advantage γ ={' '}
            {TEAM_STRENGTH_META.homeAdvantage} at true home venues only — 2026 games are neutral except for
            the hosts). Matches are weighted by <strong>recency</strong> (exponential decay, 18-month
            half-life) and <strong>competition importance</strong> (World Cup 2.5× &gt; continental finals 2×
            &gt; qualifiers/Nations League 1.5× &gt; friendlies 1×), and thin-sample teams are shrunk toward
            average. We fit every national team in the dataset, not just our sixteen — opponent strength
            shapes the fit. We omit Dixon-Coles' ρ
            (low-score correction): the engine consumes only the strength levels, generating its own match
            dynamics minute by minute.
          </p>
          <p>
            <strong>Your lineup then shifts the baseline.</strong> The engine anchors each side to its fitted
            baseline and multiplies by the ratio of your XI's player-aggregate attack/defence (with
            out-of-position penalties and formation modifiers) to the real XI's aggregate. Field the real XI
            in the real formation and you get the baseline back exactly — that identity is enforced by an
            automated test.
          </p>
        </Section>

        <Section title="How a simulation runs">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Team strength.</strong> Your XI is aggregated into four phase ratings — attack, midfield,
              defence, goalkeeping — with each player weighted by the line he occupies. Anyone outside his
              natural line has all ratings multiplied down first (adjacent line ×0.75, two lines away ×0.6,
              goalkeeper swaps ×0.4).
            </li>
            <li>
              <strong>Minute by minute (1–90).</strong> Each minute, possession is computed from the two
              midfields and blended 50/50 with the <em>real</em> possession split from that fixture — so a
              match Mexico really dominated 66/34 stays Mexico-tilted unless you gut their midfield.
            </li>
            <li>
              <strong>Chances.</strong> Each side rolls for a shot with probability proportional to its
              possession and its attack-vs-defence edge. A shot gets a quality (xG) roll — mostly scrappy
              half-chances, occasionally a golden one — scaled by the shooter's shooting rating.
            </li>
            <li>
              <strong>Conversion.</strong> The chance converts with probability xG × a keeper factor: better
              opposing goalkeeping pulls conversion down. Cards, momentum swings and red-card weakening run
              alongside.
            </li>
            <li>
              <strong>Knockout rules.</strong> Level at 90' → extra time with fatigue (more chances, more
              cards). Still level → penalty shootout: five kicks each then sudden death.
            </li>
            <li>
              <strong>Monte Carlo.</strong> Your kick-off also replays the fixture{' '}
              {MONTE_CARLO_RUNS.toLocaleString('en-US')} times with derived seeds for the win-probability
              breakdown. Same seed → identical match: every result is reproducible.
            </li>
          </ol>
          <p>
            Every simulated event records the numbers it was rolled from — tap any event in the match
            timeline to see them.
          </p>
        </Section>

        <Section title="The formulas">
          <Formula>
            attack/defence baseline = 75 · exp(fitted param ÷ 1.8), anchored: baseline × (your XI ÷ real XI)
            <br />
            possession(min) = blend( mid_home² / (mid_home² + mid_away²), real_possession, 50/50 )
            <br />
            P(shot per min) = 0.30 × timeFactor(min) × possession × (attack ÷ opp_defence)^1.8 × momentum
            <br />
            timeFactor = empirical goal-minute factor (5' bins, mean 1 — football scores late in halves)
            <br />
            chance quality xG = (0.02 + 0.40·u³) × (empirical xG/shot ÷ 0.12) × clamp(shooting ÷ 80, 0.6…1.3)
            <br />
            P(goal | shot) = xG × keeper_factor, keeper_factor = clamp(1 − (GK − 75) ÷ 150, 0.70…1.15)
            <br />
            momentum: after a goal ×1.12 for 6 min; random swings ×1.18 for 7 min (2%/min)
            <br />
            cards: yellow 1.8%/min per side · red 0.09%/min · second yellow = red
            <br />
            red card: attack ×0.70, midfield ×0.75, defence ×0.85 (plus the lost player)
            <br />
            extra time (91–120'): chance rates ×1.3, card risk ×1.6
            <br />
            penalty kick: P = {SHOOTOUT_BASE_CONVERSION} + (shooting − 75) ÷ 260 − (keeper − 78) ÷ 320, clamped 42…92%
          </Formula>
          <p className="text-xs text-muted">
            u is a uniform random roll in [0,1). All randomness comes from one seeded generator
            (mulberry32), so a seed fully determines a match. Empirical constants are built offline by the
            data pipeline and committed as versioned JSON.
          </p>
        </Section>

        <Section title="Formations">
          <p>
            Each team defaults to the formation it really played that day. Switching shape in the editor
            re-seats your XI by natural position and applies the shape's phase multipliers before a ball is
            kicked — midfield also drives the possession tug-of-war, so a midfield penalty is a possession
            penalty, and <em>chance quality</em> scales the xG roll of every chance the team creates. When a
            modifier is in play, event reasoning cites it (e.g. "attack 84 (×1.08 4-2-4 shape)").
          </p>
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className={`border-b border-white/10 text-left ${LABEL}`}>
                  <th className="py-2 pr-3 font-bold">Shape</th>
                  <th className="py-2 pr-3 font-bold">Attack</th>
                  <th className="py-2 pr-3 font-bold">Midfield / possession</th>
                  <th className="py-2 pr-3 font-bold">Defence</th>
                  <th className="py-2 font-bold">Chance quality</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {Object.values(FORMATIONS).map((formation) => (
                  <tr key={formation.name} className="border-b border-white/5" title={formation.blurb}>
                    <td className="py-1.5 pr-3 font-display font-black text-floodlight">{formation.name}</td>
                    <td className="py-1.5 pr-3">×{formation.modifiers.attack.toFixed(2)}</td>
                    <td className="py-1.5 pr-3">×{formation.modifiers.midfield.toFixed(2)}</td>
                    <td className="py-1.5 pr-3">×{formation.modifiers.defence.toFixed(2)}</td>
                    <td className="py-1.5">×{formation.modifiers.chanceQuality.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            4-5-1 and 5-1-4 aren't in the picker by default — they exist because Morocco and Canada really
            used them, and a team's real shape is always available. Values are design choices, calibrated so
            the real winners keep winning a plausible share of replays.
          </p>
        </Section>

        <Section title="The 3D territory portrait">
          <p>
            On the match screen a live <strong>3D pitch</strong> hangs in view, driven by the same playhead.
            Two translucent <strong>territory sheets</strong> in the teams' colours share the field, and the{' '}
            <strong>line where they meet is the ground each side holds</strong>. A raised wave rides that line
            and <strong>slides with momentum</strong> — when a team presses, its colour pushes across the
            halfway line into the opponent's territory, then the tide turns. <strong>Sharp peaks</strong> stab
            up where shots happen (taller for a better chance), a <strong>goal floods</strong> the spot in the
            scorer's colour, and <strong>teams switch ends at half-time</strong>. Pins mark goals and red cards.
          </p>
          <p>
            <strong>One honest caveat.</strong> The engine doesn't simulate <em>where</em> on the pitch a shot
            is taken, so the peaks don't pretend to. Each one's spot is a{' '}
            <strong>deterministic pseudo-position</strong> — hashed from the event's minute and player and
            biased toward that side's attacking third. The same shot always lands in the same place, but it's an{' '}
            <em>impression</em> of the attack, not a recorded coordinate. The territory line and the peak
            heights (possession tilt and chance quality) are real, engine-derived numbers.
          </p>
        </Section>

        <Section title="Honest limits">
          <p>
            The model is grounded in real data now, but it is still probabilistic entertainment — not a
            prediction service. International football's sample sizes are small (a national team plays
            ~15 matches a year, so even four years of results is a thin signal); player ratings remain
            editorial estimates until the FC 26 integration lands, and even then a video game's numbers are
            one editorial view of ability; and the minute-level engine is a stylized simplification that
            knows nothing about injuries, weather, referees or tactics beyond formation shapes. The
            calibration suite checks that real winners win plausible shares across all 16 played matches —
            that keeps the model honest, it does not make it an oracle.
          </p>
          <p>
            <strong>And to be explicit about what this site is:</strong> The Replay Cup is an independent
            fan project, not affiliated with, endorsed by, or sponsored by FIFA. Team names, results and
            player names are factual references to real public events; no official marks, crests or assets
            are used anywhere in the app. The data behind the model is credited above — the martj42
            international-results dataset (public domain/CC0), StatsBomb Open Data (© StatsBomb, used with
            credit under their open-data licence), and an unofficial community extract of EA SPORTS FC 26
            ratings via Kaggle (credit: rovnez).
          </p>
        </Section>

        <div className="flex justify-center gap-3 pt-2">
          <Link to="/" className={`px-5 py-2.5 ${BTN_SECONDARY}`}>
            Intro
          </Link>
          <Link
            to="/bracket"
            className={`rounded-lg px-5 py-2.5 font-display text-sm font-black uppercase tracking-widest text-night ${FOCUS_RING}`}
            style={{ background: 'linear-gradient(100deg, #2fbf71, #5aa9ff)' }}
          >
            To the bracket ▸
          </Link>
        </div>
      </div>
    </main>
  )
}
