import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SourceBadge } from '../components/ui/SourceBadge'
import { FORMATIONS } from '../data/formations'
import { PLAYER_RATINGS_META } from '../data/players'
import { TEAM_STRENGTH_META } from '../data/teamStrength'
import { CALIBRATION_META, CONVERSION_SAMPLE, SHOOTOUT_BASE_CONVERSION } from '../engine/empirical'
import { POSSESSION } from '../engine/possession'
import { PAUSE_MINUTES } from '../engine/simulate'
import { TACTIC_DIALS } from '../engine/tactics'
import { RATING_WEIGHTS } from '../services/playerRatings'
import { MONTE_CARLO_RUNS } from '../services/simulation'
import { MAX_HALFTIME_SUBS } from '../state/appState'
import { BTN_PRIMARY, BTN_SECONDARY, LABEL } from '../ui/theme'

function Section({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="rounded-2xl border border-ink/10 bg-night-2/70 p-6"
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
    <div className="scroll-area overflow-x-auto rounded-lg border border-ink/10 bg-night p-4 font-mono text-xs leading-loose text-floodlight/90">
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
          <p>
            The engine plays <strong>possessions</strong>, not dice rolls for shots. Every minute the side with
            the ball (a possession tug-of-war between the two midfields, blended 50/50 with the fixture's{' '}
            <em>real</em> possession split) builds an attack as a chain of contested steps on a real pitch —
            and the ball's path, every shot's location and every card come out of that chain.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Team strength.</strong> Your XI is aggregated into four phase ratings — attack, midfield,
              defence, goalkeeping — with each player weighted by the line he occupies. Anyone outside his
              natural line has all ratings multiplied down first (adjacent line ×0.75, two lines away ×0.6,
              goalkeeper swaps ×0.4). Attack and defence are then anchored to the results-fitted baseline
              (above).
            </li>
            <li>
              <strong>Zones.</strong> The pitch is three thirds by three lanes. From the formation slots, each
              player's influence over each zone is a Gaussian of distance to it, so a 4-2-4 really is thin in
              the middle third and a back five really does crowd its own box. Per zone the engine knows who
              is likely on the ball, who shoots, who defends, and how good each group is.
            </li>
            <li>
              <strong>Building an attack.</strong> A possession starts where the ball was won (or from a
              restart). Out of the defensive third it must beat the opponent's press; through the middle it
              must beat their midfield; from the final third it tries to break in — a through-ball, a
              combination, a cross, a cut-back or a dribble — and shoot. Each step succeeds with a
              probability set by the anchored attack/defence ratio (raised to a power that sums to the
              same 1.8 the old per-minute model used, so the calibrated goal rates carry over) and nudged by
              the two zone groups actually contesting it. A failed step is a <strong>turnover</strong>; a
              turnover high up the pitch can become a <strong>fast break</strong> the other way.
            </li>
            <li>
              <strong>Shots and xG.</strong> The shot's location comes from the kind of entry that created
              it; its expected goals come from a logistic model on <em>distance</em> and the{' '}
              <em>visible goal angle</em> — the shape every public xG model shares (penalty spot ≈ 0.25,
              six-yard line ≈ 0.5, 25 m out ≈ 0.05) — scaled for the situation (header, through on goal,
              cut-back, fast break), the shooter's shooting rating and the attacking shape, and rescaled so the
              mean chance matches real knockout football. The chance converts with probability xG × a keeper
              factor; otherwise it is blocked, saved (a corner may follow) or off target. Assists and key
              passes go to the man who played the last ball.
            </li>
            <li>
              <strong>Set pieces and fouls.</strong> Corners produce aerial duels in the box; fouls come out
              of the contests (the more aggressive the defenders covering the zone, the likelier), yellow and
              red cards out of the fouls, direct free kicks from fouls in range and{' '}
              <strong>penalties</strong> from fouls in the box, converted with the same odds as a shootout
              kick. Cards, fouls, corners and penalties are all tuned to real knockout-match rates (see the
              volumes below).
            </li>
            <li>
              <strong>Knockout rules.</strong> Level at 90' → extra time with fatigue (more chances, more
              fouls). Still level → penalty shootout: five kicks each then sudden death.
            </li>
            <li>
              <strong>Monte Carlo.</strong> Your kick-off also replays the fixture{' '}
              {MONTE_CARLO_RUNS.toLocaleString('en-US')} times with derived seeds for the win-probability
              breakdown, in a background thread so the page never stalls. Same seed → identical match: every
              result, every pass, is reproducible.
            </li>
          </ol>
          <p>
            Every simulated event records the numbers it was rolled from — the move that led to it, where the
            shot came from, the location xG and every multiplier — tap any event in the match timeline to
            see them.
          </p>
        </Section>

        <Section title="The formulas">
          <Formula>
            attack/defence baseline = 75 · exp(fitted param ÷ 1.8), anchored: baseline × (your XI ÷ real XI)
            <br />
            possession(min) = blend( mid_home² / (mid_home² + mid_away²), real_possession, 50/50 )
            <br />
            step success = base × (attack ÷ opp_defence)^power × (zone group ÷ opp zone group)^{POSSESSION.zonePower}{' '}
            × instructions × √(timeFactor × momentum × fatigue)
            <br />
            &nbsp;&nbsp;build-out {POSSESSION.buildOut} (^{POSSESSION.buildOutPower}) · progression {POSSESSION.progress} (^
            {POSSESSION.progressPower}, plus midfield ratio^{POSSESSION.midfieldPower}) · final-third entry {POSSESSION.entry} (^
            {POSSESSION.entryPower})
            <br />
            timeFactor = empirical goal-minute factor (5' bins, mean 1 — football scores late in halves)
            <br />
            location xG = 1 ÷ (1 + e^−(−1.2 − 0.085·distance_m + 1.6·goal_angle_rad)) × situation × clamp((shooting ÷ 80)^0.6, 0.7…1.25) × shape × {POSSESSION.xgScale}
            <br />
            situations: header ×{POSSESSION.headerXg} · through on goal ×{POSSESSION.throughBallXg} · cut-back ×{POSSESSION.cutbackXg} · fast break ×
            {POSSESSION.fastBreakXg} · free kick ×{POSSESSION.freeKickXg} · corner header ×{POSSESSION.cornerHeaderXg}
            <br />
            P(goal | shot) = xG × keeper_factor, keeper_factor = clamp(1 − (GK − 75) ÷ 150, 0.70…1.15)
            <br />
            not a goal: blocked {Math.round(POSSESSION.blockedShare * 100)}% (headers {Math.round(POSSESSION.headerBlockedShare * 100)}%), else on target per the
            empirical share, else off; corners from blocks {Math.round(POSSESSION.cornerFromBlock * 100)}% and saves{' '}
            {Math.round(POSSESSION.cornerFromSave * 100)}%
            <br />
            fouls: {Math.round(POSSESSION.foulChance * 100)}% of defensive contests (× zone aggression ÷ 75 × instructions), in the box{' '}
            {(POSSESSION.boxFoulChance * 100).toFixed(1)}% of entries → penalty
            <br />
            cards: yellow {Math.round(POSSESSION.yellowGivenFoul * 100)}% of fouls ({Math.round(POSSESSION.yellowGivenPenaltyFoul * 100)}% for a penalty foul) · straight red{' '}
            {(POSSESSION.redGivenFoul * 100).toFixed(1)}% · a booked player draws a second yellow {Math.round(POSSESSION.secondYellowScale * 100)}% as often
            <br />
            fast break after a turnover in the opponent's half: {Math.round(POSSESSION.counterChance * 100)}% × instructions × (front pace ÷ their back-line pace)^0.7;
            steps ×{POSSESSION.fastBreakStep}, xG ×{POSSESSION.fastBreakXg}
            <br />
            momentum: after a goal ×1.12 for 6 min; random swings ×1.18 for 7 min (2%/min)
            <br />
            red card: attack ×0.70, midfield ×0.75, defence ×0.85 (plus the lost player)
            <br />
            extra time (91–120'): chance creation ×1.3, foul and card risk ×1.6
            <br />
            penalty kick: P = {SHOOTOUT_BASE_CONVERSION} + (shooting − 75) ÷ 260 − (keeper − 78) ÷ 320, clamped 42…92%
          </Formula>
          <p className="text-xs text-muted">
            All randomness comes from one seeded generator (mulberry32), so a seed fully determines a match.
            Empirical constants are built offline by the data pipeline and committed as versioned JSON. The
            possession constants are tuned so that, over the sixteen real fixtures, a match averages about 25
            shots, 2.6 goals, 3.5 yellows, 0.12 reds, 24 fouls, 11 corners and a penalty every third game —
            real knockout numbers — and that check runs as an automated test alongside the calibration
            suite.
          </p>
        </Section>

        <Section title="Instructions">
          <p>
            Beyond shape, each team takes three <strong>instructions</strong>. They never touch a player's
            ratings — they change how possessions unfold, and every one is a trade-off. The real match is
            replayed with the neutral setting; the editor shows the exact multipliers in play.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            {TACTIC_DIALS.map((dial) => (
              <li key={dial.key}>
                <strong>{dial.label}.</strong>{' '}
                {dial.options.map((o, i) => (
                  <span key={o.value}>
                    <em>{o.label}</em> — {o.blurb}
                    {i < dial.options.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Manager mode">
          <p>
            The match stops at the whistle on {PAUSE_MINUTES[0]}' and, if you ask it to, at the substitution
            windows on {PAUSE_MINUTES.slice(1).join("' and ")}'. At every stop you can change personnel, shape
            or instructions for either side under real rules: <strong>{MAX_HALFTIME_SUBS} substitutions</strong> across
            the whole match, a player who has come off cannot return, and a sent-off player plays no further
            part. Before you confirm, the engine replays <em>the rest of this match</em> — same score, same
            cards — {MONTE_CARLO_RUNS.toLocaleString('en-US')} times with and without your change, from the
            same seeds, so the difference is your change alone. Nothing already played is ever re-rolled: the
            frozen match continues on the same random stream, and a pause where nothing changes is
            byte-identical to not pausing at all.
          </p>
          <p>
            Every interactive match is kept as a small <strong>script</strong> — the seed, the kick-off
            lineups and each confirmed change — which replays it exactly. That is what brings your result back
            after a reload.
          </p>
        </Section>

        <Section title="Player ratings">
          <p>
            The post-match ratings are a fixed formula over the engine's own per-player numbers, on the
            familiar 4–10 scale, starting from {RATING_WEIGHTS.base.toFixed(1)}: +{RATING_WEIGHTS.goal} per goal, +
            {RATING_WEIGHTS.assist} per assist, +{RATING_WEIGHTS.xg} per xG taken and +{RATING_WEIGHTS.xa} per xG created, +
            {RATING_WEIGHTS.keyPass} per key pass, +{RATING_WEIGHTS.onTarget} per shot on target, +{RATING_WEIGHTS.passCompleted} per
            progressive pass completed ({RATING_WEIGHTS.passMissed} when it fails), +{RATING_WEIGHTS.carry} per carry, +
            {RATING_WEIGHTS.tackle} per defensive action, +{RATING_WEIGHTS.save} per save, {RATING_WEIGHTS.foul} per foul, {RATING_WEIGHTS.yellow} per
            yellow, {RATING_WEIGHTS.red} for a red, +{RATING_WEIGHTS.cleanSheet} clean-sheet bonus for keepers and defenders, ±
            {RATING_WEIGHTS.win} for the result. The Man of the Match is simply the top rating (ties go to goals, then
            assists). Passes here are the progressive passes the possession engine plays, not every touch.
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
                <tr className={`border-b border-ink/10 text-left ${LABEL}`}>
                  <th className="py-2 pr-3 font-bold">Shape</th>
                  <th className="py-2 pr-3 font-bold">Attack</th>
                  <th className="py-2 pr-3 font-bold">Midfield / possession</th>
                  <th className="py-2 pr-3 font-bold">Defence</th>
                  <th className="py-2 font-bold">Chance quality</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {Object.values(FORMATIONS).map((formation) => (
                  <tr key={formation.name} className="border-b border-ink/5" title={formation.blurb}>
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

        <Section title="The 3D pitch">
          <p>
            On the match screen a live <strong>3D pitch</strong> plays the same match the engine simulated,
            driven by the same playhead. Every possession the engine plays is a chain of real touches with a
            pitch coordinate — a build-up from the back, a switch through midfield, a cross or a through-ball,
            the shot — and the ball travels exactly those points. The <strong>22 players</strong> hold their
            formation shapes and move as blocks: the side in possession pushes up behind the ball, the other
            drops and compacts in front of its goal, everyone drifts toward the ball's lane, and the man on the
            ball stands on it. Shots fly at the goal and end the way the engine said they did — in the net,
            in the keeper's hands, blocked or wide. Cards float over the players who earned them, and{' '}
            <strong>teams switch ends at half-time</strong>. Hover or tap any player for his live numbers; the
            shot-map overlay accumulates every attempt at its real spot, sized by xG.
          </p>
          <p>
            <strong>What is and isn't measured.</strong> The ball's path, the shot locations and their xG are
            the engine's own data. The off-ball player positions are a <em>rendering</em>: a formation shape
            that responds to the ball, not a per-player tracking model. The alternative{' '}
            <strong>territory</strong> view draws the same match as two coloured sheets — the line where they
            meet is the possession tilt, peaks rise where shots happened.
          </p>
        </Section>

        <Section title="Honest limits">
          <p>
            The model is grounded in real data now, but it is still probabilistic entertainment — not a
            prediction service. International football's sample sizes are small (a national team plays
            ~15 matches a year, so even four years of results is a thin signal); player ratings remain
            editorial estimates until the FC 26 integration lands, and even then a video game's numbers are
            one editorial view of ability; and the possession engine, for all its pitch coordinates, is a
            stylized simplification — its zones and contests are a model of football, not tracking data, and
            it knows nothing about injuries, weather, referees or fatigue beyond extra time. The calibration
            suite checks that real winners win plausible shares across all 16 played matches and that the
            match volumes sit in real ranges — that keeps the model honest, it does not make it an oracle.
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
          <Link to="/bracket" className={`px-5 py-2.5 text-sm ${BTN_PRIMARY}`}>
            To the bracket ▸
          </Link>
        </div>
      </div>
    </main>
  )
}
