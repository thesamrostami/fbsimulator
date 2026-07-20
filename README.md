# The Replay Cup

**Rewrite the knockouts. See what could have been.**

An independent, fan-made what-if simulator for the 2026 World Cup knockout stage. All **14 finished matches** from the round of 16 to the semi-finals are replayable with the lineups *you* would have picked — extra time, penalty shootouts and all.

> The Replay Cup is an independent fan project and is not affiliated with, endorsed by, or sponsored by FIFA. Team names, results, and player names refer to real public information; team crests/emblems are not used. Flags are public-domain iconography via `country-flag-icons`.

## Run it

```sh
npm install
npm run dev     # → http://localhost:5173
```

```sh
npm test        # engine + data unit tests (vitest)
npm run build   # type-check + production build
```

Deployment (Docker + nginx with SPA fallback, security headers and CSP, or any static host) is covered in [DEPLOY.md](DEPLOY.md).

## Pages

- **`/`** — animated intro under the floodlights.
- **`/bracket`** — the knockout tree: 8 round-of-16 ties → 4 quarter-finals → 2 semi-finals → the final (plus the third-place play-off), with flags, real scores and AET/PENS badges. All 16 matches are played: every card glows and opens its editor. Locked-card styling remains in the code for any future unplayed fixture.
- **`/match/:id`** — lineup editor → animated simulation → result, for any played match.

## How it works

- **Lineup editor** — tap a player, then tap where he should go: another shirt to swap positions, or a bench player to substitute him in. A formation picker (real shape by default, plus 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2 / 5-3-2 / 5-4-1 / 4-2-4 / 3-4-3) re-seats the XI by natural position and applies shape modifiers to attack/midfield/defence and chance quality. Live phase bars react to every change; players placed outside their natural line get a warning badge and play worse (adjacent line ×0.75, opposite line ×0.6, goalkeeper swaps ×0.4).
- **Match simulation** — a seeded, minute-by-minute engine: shot chances are proportional to attack vs. opposing defence and possession (midfield strength blended 50/50 with the fixture's *real* possession split, so replays feel like the actual game), goals come from a shooting-quality xG roll, plus cards, momentum swings, and substitution windows. Knockout rules apply: level at 90' → extra time with fatigue (more goals, more cards), still level → an animated penalty shootout (5 kicks each, then sudden death; conversion odds from shooting rating vs keeper quality).
- **Result** — your scoreline vs. reality (goal minutes side by side, AET/PENS badges), the key differences narrated, and a 1,000-run Monte Carlo breakdown with extra-time/shootout shares and the most common scorelines. Same seed → same match, so every result is reproducible.

## Structure

```
src/
  data/teams.ts      the 16 teams: flags + palette-validated identity colors
  data/players.ts    shared player database (~400 players), one ratings object each
  data/squads.ts     verified 26-man squads per team, with sources
  data/matches.ts    the bracket: real lineups (by player id), formations, scores, stats
  engine/            pure TypeScript simulation (rng, ratings, simulate, shootout, monteCarlo)
  services/          async boundary around the engine — swap for fetch() to add a backend
  state/             per-match lineup reducer
  pages/             intro, bracket, match (react-router-dom)
  components/        screens + match/pitch/result widgets (React 18 + Tailwind v4 + Framer Motion)
scripts/dist-check.ts  calibration snapshot: npx vite-node scripts/dist-check.ts
```

The engine is UI-free and side-effect-free: `simulateMatch(home, away, seed, { knockout, homePossession })` and `runMonteCarlo(...)` could run on a server unchanged. Engine balance knobs live in `TUNING` in `src/engine/simulate.ts`.

Player ratings come from an unofficial EA SPORTS FC 26 community dataset where a player could be matched, with clearly-badged editorial estimates for the rest — a video game's editorial view of ability, not official statistics. Match results, lineups, goal minutes and possession are the real 2026 public records. Full methodology, data credits and limitations live on the in-app "How it works" page.
