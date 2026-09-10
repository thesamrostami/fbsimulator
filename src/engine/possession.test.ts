import { describe, expect, it } from 'vitest'
import { buildRealSheet, MATCHES, PLAYED_MATCHES, type PlayedMatch } from '../data/matches'
import { runMonteCarlo } from './monteCarlo'
import { PENALTY_SPOT } from './pitch'
import { simulateMatch } from './simulate'
import { isShotEvent, type PlayerMatchStats, type SimResult, type TeamSheet } from './types'

const mexEng = MATCHES['r16-4'] as PlayedMatch
const home = buildRealSheet(mexEng.home)
const away = buildRealSheet(mexEng.away)
const options = { knockout: true, homePossession: mexEng.real.possession.home / 100 }

function sims(count: number, opts = options): SimResult[] {
  return Array.from({ length: count }, (_, i) => simulateMatch(home, away, i * 17 + 3, opts))
}

describe('possession sequences', () => {
  it('cover every minute in order, inside the minute, with coordinates on the pitch', () => {
    for (const sim of sims(15)) {
      const last = sim.wentToExtraTime ? 120 : 90
      const minutes = new Set(sim.sequences.map((s) => s.minute))
      for (let m = 1; m <= last; m++) expect(minutes.has(m), `minute ${m} has a possession`).toBe(true)
      let prevMinute = 0
      let prevT = 0
      for (const seq of sim.sequences) {
        expect(seq.minute).toBeGreaterThanOrEqual(prevMinute)
        prevMinute = seq.minute
        expect(seq.t0).toBeGreaterThanOrEqual(seq.minute - 1)
        expect(seq.t1).toBeLessThanOrEqual(seq.minute)
        expect(seq.t0).toBeGreaterThanOrEqual(prevT - 1e-9)
        prevT = seq.t1
        expect(seq.points.length).toBeGreaterThan(0)
        let t = seq.t0
        for (const p of seq.points) {
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect(p.x).toBeLessThanOrEqual(1)
          expect(p.y).toBeGreaterThanOrEqual(0)
          expect(p.y).toBeLessThanOrEqual(1)
          expect(p.t).toBeGreaterThanOrEqual(t - 1e-9)
          expect(p.t).toBeLessThanOrEqual(seq.t1 + 1e-9)
          t = p.t
        }
      }
    }
  })

  it('every shot event points at the possession that produced it, ending where the shot was taken', () => {
    let shots = 0
    for (const sim of sims(15)) {
      for (const event of sim.events) {
        if (!isShotEvent(event)) continue
        shots += 1
        expect(event.spot).toBeDefined()
        expect(event.xg).toBeGreaterThan(0)
        expect(event.source).toBeDefined()
        expect(event.sequence).toBeDefined()
        const seq = sim.sequences[event.sequence!]
        expect(seq.side).toBe(event.side)
        expect(seq.minute).toBe(event.minute)
        expect(seq.outcome).toBe('shot')
        expect(seq.xg).toBe(event.xg)
        const end = seq.points[seq.points.length - 1]
        expect(end.action).toBe('shot')
        expect(end.x).toBeCloseTo(event.spot!.x, 2)
        expect(end.y).toBeCloseTo(event.spot!.y, 2)
        expect(end.playerId).toBe(event.player?.id)
      }
    }
    expect(shots).toBeGreaterThan(100)
  })

  it('a goal is credited to the player who scored and the assist to a different creator in the move', () => {
    let assisted = 0
    for (const sim of sims(30)) {
      for (const goal of sim.events.filter((e) => e.type === 'goal')) {
        expect(goal.player).toBeDefined()
        if (goal.assist) {
          assisted += 1
          expect(goal.assist.id).not.toBe(goal.player!.id)
          expect(sim.playerStats[goal.assist.id].assists).toBeGreaterThanOrEqual(1)
          const seq = sim.sequences[goal.sequence!]
          expect(seq.points.some((p) => p.playerId === goal.assist!.id)).toBe(true)
        }
      }
    }
    expect(assisted).toBeGreaterThan(10)
  })
})

describe('player stats', () => {
  const sum = (sim: SimResult, side: 'home' | 'away', key: keyof PlayerMatchStats) =>
    Object.values(sim.playerStats)
      .filter((p) => p.side === side)
      .reduce((acc, p) => acc + Number(p[key]), 0)

  it('add up to the side totals', () => {
    for (const sim of sims(20)) {
      for (const side of ['home', 'away'] as const) {
        expect(sum(sim, side, 'shots')).toBe(sim.stats[side].shots)
        expect(sum(sim, side, 'goals')).toBe(sim.stats[side].goals)
        expect(sum(sim, side, 'onTarget')).toBe(sim.stats[side].onTarget)
        expect(sum(sim, side, 'xg')).toBeCloseTo(sim.stats[side].xg, 0)
        expect(sum(sim, side, 'fouls')).toBe(sim.stats[side].fouls)
        expect(sum(sim, side, 'yellows')).toBe(sim.stats[side].yellows)
        expect(sum(sim, side, 'red')).toBe(sim.stats[side].reds)
        expect(sum(sim, side, 'assists')).toBeLessThanOrEqual(sim.stats[side].goals)
        expect(sum(sim, side, 'keyPasses')).toBeGreaterThanOrEqual(sum(sim, side, 'assists'))
      }
      // Every card event has a matching entry.
      for (const e of sim.events) {
        if (e.type === 'red-card') expect(sim.playerStats[e.player!.id].red).toBe(true)
        if (e.type === 'yellow-card') expect(sim.playerStats[e.player!.id].yellows).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('only the goalkeeper makes saves, and every saved shot is one', () => {
    for (const sim of sims(20)) {
      for (const side of ['home', 'away'] as const) {
        const sheet = side === 'home' ? home : away
        const gk = sheet.starters.find((a) => a.slot.line === 'GK')!.player.id
        const saved = sim.events.filter((e) => e.type === 'shot-saved' && e.side !== side).length
        expect(sim.playerStats[gk]?.saves ?? 0).toBe(saved)
        for (const p of Object.values(sim.playerStats)) {
          if (p.side === side && p.playerId !== gk) expect(p.saves).toBe(0)
        }
      }
    }
  })
})

describe('set pieces', () => {
  it('penalties are awarded, then taken from the spot with shootout-grade odds', () => {
    let pens = 0
    for (const sim of sims(120)) {
      sim.events.forEach((e, i) => {
        if (e.type !== 'penalty') return
        pens += 1
        // The next chance event is the kick itself.
        const kick = sim.events.slice(i + 1).find((x) => isShotEvent(x))!
        expect(kick.source).toBe('penalty')
        expect(kick.side).toBe(e.side)
        expect(kick.minute).toBe(e.minute)
        expect(kick.spot).toEqual({ x: Math.round(PENALTY_SPOT.x * 100) / 100, y: 0.5 })
        expect(kick.xg).toBeGreaterThanOrEqual(0.42)
        expect(kick.xg).toBeLessThanOrEqual(0.92)
        expect(kick.type).not.toBe('shot-blocked')
      })
      expect(sim.stats.home.penalties + sim.stats.away.penalties).toBe(
        sim.events.filter((e) => e.type === 'penalty').length,
      )
    }
    expect(pens).toBeGreaterThan(10)
  })

  it('corners are counted and produce headers from the box', () => {
    let cornerShots = 0
    for (const sim of sims(40)) {
      expect(sim.stats.home.corners + sim.stats.away.corners).toBe(
        sim.events.filter((e) => e.type === 'corner').length,
      )
      for (const e of sim.events) {
        if (isShotEvent(e) && e.source === 'corner') {
          cornerShots += 1
          expect(e.header).toBe(true)
          expect(e.spot!.x).toBeGreaterThan(0.85)
        }
      }
    }
    expect(cornerShots).toBeGreaterThan(20)
  })
})

describe('tactics', () => {
  const withTactics = (sheet: TeamSheet, tactics: TeamSheet['tactics']): TeamSheet => ({ ...sheet, tactics })
  const neutral = { mentality: 'balanced', pressing: 'mid', width: 'normal' } as const

  it('the neutral setting is byte-identical to no tactics at all', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      expect(simulateMatch(withTactics(home, neutral), withTactics(away, neutral), seed, options)).toEqual(
        simulateMatch(home, away, seed, options),
      )
    }
  })

  it('an attacking mentality scores more and concedes more; a defensive one the reverse', () => {
    const runs = 800
    const base = runMonteCarlo(home, away, runs, 99, options)
    const attacking = runMonteCarlo(withTactics(home, { ...neutral, mentality: 'attacking' }), away, runs, 99, options)
    const defensive = runMonteCarlo(withTactics(home, { ...neutral, mentality: 'defensive' }), away, runs, 99, options)
    expect(attacking.avgGoals.home).toBeGreaterThan(base.avgGoals.home)
    expect(attacking.avgGoals.away).toBeGreaterThan(base.avgGoals.away)
    expect(defensive.avgGoals.home).toBeLessThan(base.avgGoals.home)
    expect(defensive.avgGoals.away).toBeLessThan(base.avgGoals.away)
  })

  it('a high press fouls more and forces more high turnovers than a low block', () => {
    let highFouls = 0
    let lowFouls = 0
    let highBreaks = 0
    let lowBreaks = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      const high = simulateMatch(withTactics(home, { ...neutral, pressing: 'high' }), away, seed, options)
      const low = simulateMatch(withTactics(home, { ...neutral, pressing: 'low' }), away, seed, options)
      highFouls += high.stats.home.fouls
      lowFouls += low.stats.home.fouls
      highBreaks += high.sequences.filter((s) => s.side === 'home' && s.source === 'counter').length
      lowBreaks += low.sequences.filter((s) => s.side === 'home' && s.source === 'counter').length
    }
    expect(highFouls).toBeGreaterThan(lowFouls)
    expect(highBreaks).toBeGreaterThan(lowBreaks)
  })

  it('a wide team crosses more (more headed chances) than a narrow one', () => {
    let wide = 0
    let narrow = 0
    for (let seed = 1; seed <= 80; seed += 1) {
      wide += simulateMatch(withTactics(home, { ...neutral, width: 'wide' }), away, seed, options).events.filter(
        (e) => e.side === 'home' && isShotEvent(e) && e.header && e.source !== 'corner',
      ).length
      narrow += simulateMatch(withTactics(home, { ...neutral, width: 'narrow' }), away, seed, options).events.filter(
        (e) => e.side === 'home' && isShotEvent(e) && e.header && e.source !== 'corner',
      ).length
    }
    expect(wide).toBeGreaterThan(narrow)
  })
})

describe('match volumes against real knockout football', () => {
  /**
   * Honesty check on the possession engine: over the 16 real fixtures the
   * averages must sit in the bands real World Cup knockout matches show
   * (StatsBomb WC2022 knockouts; FIFA technical reports). When a band fails
   * the numbers are printed so the tuning can be reviewed deliberately, never
   * retuned silently.
   */
  const RUNS = 40
  const bands: Record<string, [number, number]> = {
    'shots / match': [20, 30],
    'on target / match': [7, 12],
    "goals / 90'": [2.2, 3.1],
    'xG / shot': [0.08, 0.14],
    'yellows / match': [2.5, 4.5],
    'reds / match': [0.05, 0.25],
    'fouls / match': [18, 32],
    'corners / match': [7, 14],
    'penalties / match': [0.15, 0.6],
    'headed shots share': [0.12, 0.35],
    'outside-box shots share': [0.3, 0.6],
  }

  it('lands in the real-football bands', () => {
    const acc = { n: 0, shots: 0, onT: 0, goals90: 0, xg: 0, yellows: 0, reds: 0, fouls: 0, corners: 0, pens: 0, headers: 0, outside: 0 }
    for (const match of PLAYED_MATCHES) {
      const h = buildRealSheet(match.home)
      const a = buildRealSheet(match.away)
      for (let i = 0; i < RUNS; i++) {
        const sim = simulateMatch(h, a, i * 31 + 7, { knockout: true, homePossession: match.real.possession.home / 100 })
        acc.n += 1
        for (const side of ['home', 'away'] as const) {
          const s = sim.stats[side]
          acc.shots += s.shots
          acc.onT += s.onTarget
          acc.xg += s.xg
          acc.yellows += s.yellows
          acc.reds += s.reds
          acc.fouls += s.fouls
          acc.corners += s.corners
          acc.pens += s.penalties
        }
        acc.goals90 += sim.regulationScore.home + sim.regulationScore.away
        for (const e of sim.events) {
          if (!isShotEvent(e)) continue
          if (e.header) acc.headers += 1
          if (e.spot && e.spot.x < 0.84) acc.outside += 1
        }
      }
    }
    const measured: Record<string, number> = {
      'shots / match': acc.shots / acc.n,
      'on target / match': acc.onT / acc.n,
      "goals / 90'": acc.goals90 / acc.n,
      'xG / shot': acc.xg / acc.shots,
      'yellows / match': acc.yellows / acc.n,
      'reds / match': acc.reds / acc.n,
      'fouls / match': acc.fouls / acc.n,
      'corners / match': acc.corners / acc.n,
      'penalties / match': acc.pens / acc.n,
      'headed shots share': acc.headers / acc.shots,
      'outside-box shots share': acc.outside / acc.shots,
    }
    const failures: string[] = []
    console.info('\nVolume report (mean over the 16 fixtures):')
    for (const [key, [lo, hi]] of Object.entries(bands)) {
      const v = measured[key]
      const ok = v >= lo && v <= hi
      if (!ok) failures.push(`${key} = ${v.toFixed(3)} (band ${lo}–${hi})`)
      console.info(`  ${ok ? 'PASS' : 'FAIL'}  ${key.padEnd(24)} ${v.toFixed(3).padStart(8)}   band ${lo}–${hi}`)
    }
    expect(failures, failures.join('; ')).toEqual([])
  }, 60000)
})
