# The Replay Cup

**Rewrite the knockouts. See what could have been.**

An independent, fan-made what-if simulator for the 2026 World Cup knockout stage. All **16 matches** from the round of 16 to the final are replayable with the lineups, shapes and instructions *you* would have picked — substitution windows, extra time, penalty shootouts and all — on a possession-level engine with a live 3D pitch.

> The Replay Cup is an independent fan project and is not affiliated with, endorsed by, or sponsored by FIFA. Team names, results, and player names refer to real public information; team crests/emblems are not used. Flags are public-domain iconography via `country-flag-icons`.

## Run it

```sh
npm install
npm run dev     # → http://localhost:5173
```

```sh
npm test        # engine, calibration, volumes, services and UI tests (vitest)
npm run lint    # oxlint
npm run build   # type-check + production build
```

Deployment (Docker + nginx with SPA fallback, security headers and CSP, or any static host) is covered in [DEPLOY.md](DEPLOY.md). The Monte Carlo Web Worker and the pre-paint theme script are same-origin files, so the shipped CSP (`script-src 'self'`) already allows them.

## Pages

- **`/`** — animated intro; light / system / dark theme switch.
- **`/bracket`** — the knockout tree: 8 round-of-16 ties → 4 quarter-finals → 2 semi-finals → the final (plus the third-place play-off), with flags, real scores and AET/PENS badges. All 16 matches are played: every card opens its editor.
- **`/match/:id`** — lineup editor → live 3D match → result and analysis, for any match.
- **`/how-it-works`** — the methodology: what is real, what is estimated, every formula and constant.

## The flow

- **Lineup editor** — tap a player, then tap where he should go (another shirt to swap positions, a bench player to substitute him in), or drag one shirt onto another with a mouse. A formation picker (real shape by default, plus 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2 / 5-3-2 / 5-4-1 / 4-2-4 / 3-4-3) re-seats the XI by natural position and applies shape modifiers. Three **instructions** per team — mentality, pressing, width — change how possessions unfold (never the ratings), each a trade-off, with the exact multipliers shown. Live phase bars react to every change; players outside their natural line get a warning badge and play worse.
- **Live match** — a **3D pitch**: 22 numbered players holding their shapes and moving as blocks with the ball, the ball travelling the engine's actual pass chains, shots flying at the goal and ending the way the engine said, cards over the players who earned them, a shot-map overlay, and hover/tap for any player's live numbers. Alongside it the xG race and a commentary feed whose every event exposes the numbers behind it. A territory-terrain view is one toggle away.
- **Manager mode** — the match stops at half-time and, on request, at the 60' and 75' substitution windows. Change personnel, shape or instructions under real rules (five substitutions across the match; a player who comes off cannot return; sent-off players stay off), and see the rest of *this* match replayed 1,000 times with and without the change before confirming.
- **Result** — your scoreline vs reality, Man of the Match and headline stats at a glance, the 1,000-run Monte Carlo with the reasons the odds moved, goal minutes side by side, the full replay on the 3D pitch, and an **Analysis** tab: the broadcast stats panel, a shot map sized by xG, and per-player ratings. A copyable match report and share summary round it off. Same seed → same match; every interactive match is kept as a small script that replays it exactly (and survives a reload).

## The engine

A seeded, deterministic **possession engine** (`src/engine/`):

- Each team's attack/defence baseline is fitted on real international results (Dixon-Coles-style weighted Poisson); your XI shifts it by its player-aggregate ratio to the real XI, with formation modifiers and out-of-position penalties.
- The pitch is three thirds by three lanes; from the formation slots the engine knows, per zone, who is on the ball, who shoots, who defends and how good each group is.
- Every minute the side with the ball (a midfield tug-of-war blended with the fixture's real possession) plays a possession: build out against the press, progress through the middle, break into the final third — through-ball, combination, cross, cut-back or dribble — and shoot. Each step is a contest; failures are turnovers, and high turnovers become fast breaks.
- Shots get a real location and a **location xG** (logistic on distance and visible goal angle), scaled by situation and shooter; corners, free kicks, in-play penalties, fouls and cards all come out of the contests. Assists, key passes, tackles, saves and every other per-player number are tracked.
- Knockout rules: extra time with fatigue, then a shootout. The match can be frozen at 45', 60' and 75' and resumed with changed sheets on the same random stream — a pause that changes nothing is byte-identical to not pausing.
- Calibration is automated: with the real lineups the real winner wins a plausible share of 500 replays in every fixture, and the match volumes (shots, goals, cards, fouls, corners, penalties, headed and long-range shares) sit in real knockout ranges.

Engine balance knobs live in `POSSESSION` (`src/engine/possession.ts`), `TUNING` (`src/engine/simulate.ts`) and the instruction table in `src/engine/tactics.ts`.

## Structure

```
src/
  data/teams.ts          the 16 teams: theme-aware identity colours (validated dark set, derived light set)
  data/players.ts        shared player database (~400 players), one ratings object each
  data/squads.ts         verified 26-man squads per team, with sources
  data/matches.ts        the bracket: real lineups (by player id), formations, scores, stats
  engine/                pure TypeScript simulation: possession.ts (contests, shots, set pieces, fouls),
                         pitch.ts (geometry + location xG), state.ts (zone profiles), tactics.ts,
                         simulate.ts (the clock, pauses, extra time), shootout.ts, monteCarlo.ts
  services/              async boundary: simulation.ts, matchScript.ts (a match as data),
                         monteCarlo.worker.ts + monteCarloClient.ts, playerRatings.ts, reports
  state/                 lineup reducer, pause rules, session store (sessionStorage-backed scripts)
  ui/                    theme tokens and the light/dark switch, drag-and-drop, scroll affordances
  pages/                 intro, bracket, match, how it works (react-router-dom)
  components/            screens + match (3D pitch, stage, pause break), pitch, result widgets
public/theme-init.js     applies the saved theme before first paint (CSP-friendly external script)
```

Player ratings come from an unofficial EA SPORTS FC 26 community dataset where a player could be matched, with clearly-badged editorial estimates for the rest — a video game's editorial view of ability, not official statistics. Match results, lineups, goal minutes and possession are the real 2026 public records. Full methodology, data credits and limitations live on the in-app "How it works" page.
