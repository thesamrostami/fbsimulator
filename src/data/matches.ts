import { applyFormationEffect, computeTeamStrength } from '../engine/ratings'
import type { TeamSheet } from '../engine/types'
import { FORMATIONS, formationSlots, type FormationName } from './formations'
import { getPlayer } from './players'
import { TEAMS, type TeamId } from './teams'
import { baselineFor } from './teamStrength'

/**
 * The 2026 World Cup knockout bracket from the round of 16 onward. Every
 * played match stores its real lineups (as player ids into the shared player
 * database), the real result and the headline stats, verbatim from the
 * official records. Two fixtures had not been played when this data was
 * captured and render locked. Formation layouts and modifiers live in
 * formations.ts.
 */

export type StageName = 'Round of 16' | 'Quarter-final' | 'Semi-final' | 'Third-place play-off' | 'Final'

export { formationSlots } from './formations'

// ── Match definitions ────────────────────────────────────────────────────────

export interface MatchSideDef {
  teamId: TeamId
  /** The formation the team really played that day. */
  formation: FormationName
  /** 11 player ids in slot order: GK, then DEF/MID/FWD each right-to-left. */
  starters: string[]
  bench: string[]
}

export interface RealGoal {
  minute: number
  teamId: TeamId
  /** Scorer, where the records name one. */
  player?: string
  /** Set for goals scored in extra time. */
  extraTime?: boolean
}

export interface RealRedCard {
  minute: number
  teamId: TeamId
  player: string
}

export interface RealYellowCard {
  minute: number
  teamId: TeamId
}

export interface RealResult {
  score: { home: number; away: number }
  /** How the tie was decided when not in 90 minutes. */
  decidedBy?: 'AET' | 'PENS'
  /** Which side won the shootout, when decidedBy is PENS. */
  pensWinner?: 'home' | 'away'
  goals: RealGoal[]
  redCards: RealRedCard[]
  /** Bookings, where the records list them. */
  yellowCards?: RealYellowCard[]
  /** Real possession share, home + away = 100. */
  possession: { home: number; away: number }
  shots: { home: { total: number; onTarget: number }; away: { total: number; onTarget: number } }
  note?: string
}

export interface PlayedMatch {
  id: string
  stage: StageName
  date: string
  played: true
  home: MatchSideDef
  away: MatchSideDef
  real: RealResult
}

export interface LockedMatch {
  id: string
  stage: StageName
  date: string
  played: false
  homeTeamId: TeamId | null
  awayTeamId: TeamId | null
  /** Marks fixtures outside the main knockout path (rendered as secondary nodes). */
  type?: 'third-place'
}

export type MatchDef = PlayedMatch | LockedMatch

const side = (
  teamId: TeamId,
  formation: FormationName,
  starters: string[],
  bench: string[],
): MatchSideDef => ({ teamId, formation, starters, bench })

export const MATCHES: Record<string, MatchDef> = {
  'r16-1': {
    id: 'r16-1',
    stage: 'Round of 16',
    date: '2026-07-04',
    played: true,
    home: side('PAR', '5-4-1', [
      'par-gill',
      'par-caceres', 'par-velazquez', 'par-g-gomez', 'par-alderete', 'par-alonso',
      'par-almiron', 'par-d-gomez', 'par-cubas', 'par-galarza',
      'par-enciso',
    ], ['par-fernandez', 'par-bobadilla', 'par-sosa', 'par-arce']),
    away: side('FRA', '4-2-4', [
      'fra-maignan',
      'fra-kounde', 'fra-upamecano', 'fra-saliba', 'fra-digne',
      'fra-kone', 'fra-rabiot',
      'fra-dembele', 'fra-olise', 'fra-barcola', 'fra-mbappe',
    ], ['fra-risser', 'fra-akliouche', 'fra-zaire-emery', 'fra-doue']),
    real: {
      score: { home: 0, away: 1 },
      goals: [{ minute: 70, teamId: 'FRA' }],
      redCards: [],
      possession: { home: 24, away: 76 },
      shots: { home: { total: 5, onTarget: 1 }, away: { total: 15, onTarget: 5 } },
    },
  },

  'r16-2': {
    id: 'r16-2',
    stage: 'Round of 16',
    date: '2026-07-04',
    played: true,
    home: side('CAN', '5-1-4', [
      'can-crepeau',
      'can-johnston', 'can-bombito', 'can-defougerolles', 'can-laryea', 'can-sigur',
      'can-eustaquio',
      'can-buchanan', 'can-ahmed', 'can-david', 'can-oluwaseyi',
    ], ['can-goodman', 'can-p-david', 'can-millar', 'can-osorio']),
    away: side('MAR', '4-5-1', [
      'mar-bounou',
      'mar-hakimi', 'mar-halhal', 'mar-diop', 'mar-mazraoui',
      'mar-bouaddi', 'mar-elaynaoui', 'mar-ounahi', 'mar-elkhannouss', 'mar-saibari',
      'mar-brahim',
    ], ['mar-elkajoui', 'mar-talbi', 'mar-elmourabet', 'mar-yassine']),
    real: {
      score: { home: 0, away: 3 },
      goals: [
        { minute: 50, teamId: 'MAR' },
        { minute: 82, teamId: 'MAR' },
        { minute: 90, teamId: 'MAR' },
      ],
      redCards: [],
      possession: { home: 44, away: 56 },
      shots: { home: { total: 10, onTarget: 3 }, away: { total: 5, onTarget: 4 } },
    },
  },

  'r16-3': {
    id: 'r16-3',
    stage: 'Round of 16',
    date: '2026-07-05',
    played: true,
    home: side('BRA', '4-2-4', [
      'bra-alisson',
      'bra-danilo', 'bra-marquinhos', 'bra-gabriel', 'bra-douglas',
      'bra-bruno', 'bra-casemiro',
      'bra-rayan', 'bra-cunha', 'bra-martinelli', 'bra-vinicius',
    ], ['bra-endrick', 'bra-danilo-santos', 'bra-luiz-henrique', 'bra-igor-thiago']),
    away: side('NOR', '4-3-3', [
      'nor-nyland',
      'nor-ryerson', 'nor-ajer', 'nor-heggem', 'nor-wolfe',
      'nor-berge', 'nor-odegaard', 'nor-berg',
      'nor-sorloth', 'nor-haaland', 'nor-nusa',
    ], ['nor-bobb', 'nor-falchener', 'nor-langas', 'nor-schjelderup']),
    real: {
      score: { home: 1, away: 2 },
      goals: [
        { minute: 79, teamId: 'NOR' },
        { minute: 90, teamId: 'NOR' },
        { minute: 90, teamId: 'BRA' },
      ],
      redCards: [],
      possession: { home: 34, away: 66 },
      shots: { home: { total: 12, onTarget: 4 }, away: { total: 9, onTarget: 5 } },
    },
  },

  'r16-4': {
    id: 'r16-4',
    stage: 'Round of 16',
    date: '2026-07-06',
    played: true,
    home: side('MEX', '4-3-3', [
      'mex-rangel',
      'mex-sanchez', 'mex-montes', 'mex-vasquez', 'mex-gallardo',
      'mex-mora', 'mex-lira', 'mex-romo',
      'mex-alvarado', 'mex-jimenez', 'mex-quinones',
    ], ['mex-reyes', 'mex-gutierrez', 'mex-vargas', 'mex-chavez']),
    away: side('ENG', '4-3-3', [
      'eng-pickford',
      'eng-quansah', 'eng-konsa', 'eng-guehi', 'eng-oreilly',
      'eng-anderson', 'eng-rice', 'eng-bellingham',
      'eng-saka', 'eng-kane', 'eng-gordon',
    ], ['eng-trafford', 'eng-mainoo', 'eng-rogers', 'eng-madueke']),
    real: {
      score: { home: 2, away: 3 },
      goals: [
        { minute: 36, teamId: 'ENG', player: 'Kane' },
        { minute: 38, teamId: 'ENG', player: 'Saka' },
        { minute: 42, teamId: 'MEX', player: 'Jimenez' },
        { minute: 60, teamId: 'ENG', player: 'Bellingham' },
        { minute: 69, teamId: 'MEX', player: 'Alvarado' },
      ],
      redCards: [{ minute: 54, teamId: 'ENG', player: 'Quansah' }],
      possession: { home: 66, away: 34 },
      shots: { home: { total: 23, onTarget: 5 }, away: { total: 6, onTarget: 5 } },
    },
  },

  'r16-5': {
    id: 'r16-5',
    stage: 'Round of 16',
    date: '2026-07-06',
    played: true,
    home: side('POR', '4-3-3', [
      'por-costa',
      'por-cancelo', 'por-dias', 'por-veiga', 'por-mendes',
      'por-neves', 'por-vitinha', 'por-bruno',
      'por-neto', 'por-ronaldo', 'por-felix',
    ], ['por-sa', 'por-conceicao', 'por-samu-costa', 'por-inacio']),
    away: side('ESP', '4-3-3', [
      'esp-simon',
      'esp-porro', 'esp-cubarsi', 'esp-laporte', 'esp-cucurella',
      'esp-rodri', 'esp-pedri', 'esp-baena',
      'esp-yamal', 'esp-oyarzabal', 'esp-olmo',
    ], ['esp-zubimendi', 'esp-nico', 'esp-gavi', 'esp-pubill']),
    real: {
      score: { home: 0, away: 1 },
      goals: [{ minute: 90, teamId: 'ESP' }],
      redCards: [],
      possession: { home: 44, away: 56 },
      shots: { home: { total: 10, onTarget: 3 }, away: { total: 15, onTarget: 6 } },
    },
  },

  'r16-6': {
    id: 'r16-6',
    stage: 'Round of 16',
    date: '2026-07-07',
    played: true,
    home: side('USA', '5-3-2', [
      'usa-freese',
      'usa-freeman', 'usa-richards', 'usa-ream', 'usa-dest', 'usa-robinson',
      'usa-mckennie', 'usa-adams', 'usa-tillman',
      'usa-pulisic', 'usa-balogun',
    ], ['usa-brady', 'usa-berhalter', 'usa-arfsten', 'usa-zendejas']),
    away: side('BEL', '4-3-3', [
      'bel-courtois',
      'bel-castagne', 'bel-ngoy', 'bel-mechele', 'bel-decuyper',
      'bel-onana', 'bel-tielemans', 'bel-raskin',
      'bel-lukebakio', 'bel-dekete', 'bel-trossard',
    ], ['bel-dewinter', 'bel-witsel', 'bel-debast', 'bel-moreira']),
    real: {
      score: { home: 1, away: 4 },
      goals: [
        { minute: 9, teamId: 'BEL' },
        { minute: 31, teamId: 'USA' },
        { minute: 33, teamId: 'BEL' },
        { minute: 57, teamId: 'BEL' },
        { minute: 90, teamId: 'BEL' },
      ],
      redCards: [],
      possession: { home: 57, away: 43 },
      shots: { home: { total: 6, onTarget: 2 }, away: { total: 15, onTarget: 7 } },
    },
  },

  'r16-7': {
    id: 'r16-7',
    stage: 'Round of 16',
    date: '2026-07-07',
    played: true,
    home: side('ARG', '4-4-2', [
      'arg-emartinez',
      'arg-molina', 'arg-romero', 'arg-lmartinez', 'arg-tagliafico',
      'arg-depaul', 'arg-paredes', 'arg-enzo', 'arg-macallister',
      'arg-messi', 'arg-alvarez',
    ], ['arg-barco', 'arg-simeone', 'arg-nicopaz', 'arg-jmlopez']),
    away: side('EGY', '4-4-2', [
      'egy-shoubir',
      'egy-hany', 'egy-rabia', 'egy-ibrahim', 'egy-hafez',
      'egy-attia', 'egy-lashin', 'egy-ashour', 'egy-zico',
      'egy-salah', 'egy-hassan',
    ], ['egy-abdelmaguid', 'egy-tarekalaa', 'egy-saber', 'egy-alaa']),
    real: {
      score: { home: 3, away: 2 },
      goals: [
        { minute: 15, teamId: 'EGY' },
        { minute: 67, teamId: 'EGY' },
        { minute: 79, teamId: 'ARG' },
        { minute: 83, teamId: 'ARG' },
        { minute: 90, teamId: 'ARG' },
      ],
      redCards: [],
      possession: { home: 58, away: 42 },
      shots: { home: { total: 17, onTarget: 7 }, away: { total: 4, onTarget: 2 } },
      note: 'Argentina came back from 0–2 down.',
    },
  },

  'r16-8': {
    id: 'r16-8',
    stage: 'Round of 16',
    date: '2026-07-07',
    played: true,
    home: side('SUI', '3-5-2', [
      'sui-kobel',
      'sui-elvedi', 'sui-akanji', 'sui-rodriguez',
      'sui-zakaria', 'sui-jashari', 'sui-xhaka', 'sui-freuler', 'sui-rieder',
      'sui-ndoye', 'sui-embolo',
    ], ['sui-keller', 'sui-amenda', 'sui-amdouni', 'sui-comert']),
    away: side('COL', '5-3-2', [
      'col-vargas',
      'col-munoz', 'col-dsanchez', 'col-lucumi', 'col-puerta', 'col-mojica',
      'col-lerma', 'col-arias', 'col-james',
      'col-suarez', 'col-diaz',
    ], ['col-castano', 'col-portilla', 'col-rios', 'col-ditta']),
    real: {
      score: { home: 0, away: 0 },
      decidedBy: 'PENS',
      pensWinner: 'home',
      goals: [],
      redCards: [],
      possession: { home: 53, away: 47 },
      shots: { home: { total: 7, onTarget: 2 }, away: { total: 15, onTarget: 3 } },
      note: 'Goalless after 120 minutes; Switzerland won the shootout.',
    },
  },

  'qf-1': {
    id: 'qf-1',
    stage: 'Quarter-final',
    date: '2026-07-09',
    played: true,
    home: side('FRA', '4-2-4', [
      'fra-maignan',
      'fra-kounde', 'fra-upamecano', 'fra-saliba', 'fra-digne',
      'fra-kone', 'fra-rabiot',
      'fra-dembele', 'fra-olise', 'fra-doue', 'fra-mbappe',
    ], ['fra-akliouche', 'fra-zaire-emery', 'fra-risser', 'fra-samba']),
    away: side('MAR', '4-5-1', [
      'mar-bounou',
      'mar-hakimi', 'mar-diop', 'mar-mazraoui', 'mar-salaheddine',
      'mar-bouaddi', 'mar-elaynaoui', 'mar-ounahi', 'mar-elkhannouss', 'mar-talbi',
      'mar-brahim',
    ], ['mar-rahimi', 'mar-sbai', 'mar-halhal', 'mar-elmourabet']),
    real: {
      score: { home: 2, away: 0 },
      goals: [
        { minute: 60, teamId: 'FRA' },
        { minute: 66, teamId: 'FRA' },
      ],
      redCards: [],
      possession: { home: 48, away: 52 },
      shots: { home: { total: 22, onTarget: 9 }, away: { total: 5, onTarget: 1 } },
    },
  },

  'qf-2': {
    id: 'qf-2',
    stage: 'Quarter-final',
    date: '2026-07-10',
    played: true,
    home: side('ESP', '4-3-3', [
      'esp-simon',
      'esp-porro', 'esp-cubarsi', 'esp-laporte', 'esp-cucurella',
      'esp-rodri', 'esp-fabian', 'esp-baena',
      'esp-yamal', 'esp-oyarzabal', 'esp-olmo',
    ], ['esp-nico', 'esp-gavi', 'esp-pubill', 'esp-vmunoz']),
    away: side('BEL', '4-3-3', [
      'bel-courtois',
      'bel-castagne', 'bel-ngoy', 'bel-mechele', 'bel-decuyper',
      'bel-raskin', 'bel-vanaken', 'bel-debruyne',
      'bel-doku', 'bel-dekete', 'bel-trossard',
    ], ['bel-moreira', 'bel-seys', 'bel-penders', 'bel-fpardo']),
    real: {
      score: { home: 2, away: 1 },
      goals: [
        { minute: 30, teamId: 'ESP' },
        { minute: 41, teamId: 'BEL' },
        { minute: 88, teamId: 'ESP' },
      ],
      redCards: [],
      possession: { home: 68, away: 32 },
      shots: { home: { total: 18, onTarget: 8 }, away: { total: 5, onTarget: 2 } },
    },
  },

  'qf-3': {
    id: 'qf-3',
    stage: 'Quarter-final',
    date: '2026-07-11',
    played: true,
    home: side('NOR', '4-4-2', [
      'nor-nyland',
      'nor-ryerson', 'nor-ajer', 'nor-heggem', 'nor-wolfe',
      'nor-berge', 'nor-odegaard', 'nor-berg', 'nor-schjelderup',
      'nor-sorloth', 'nor-haaland',
    ], ['nor-nusa', 'nor-bobb', 'nor-falchener', 'nor-tangvik']),
    away: side('ENG', '4-3-3', [
      'eng-pickford',
      'eng-konsa', 'eng-stones', 'eng-guehi', 'eng-oreilly',
      'eng-anderson', 'eng-rice', 'eng-bellingham',
      'eng-madueke', 'eng-kane', 'eng-gordon',
    ], ['eng-trafford', 'eng-eze', 'eng-mainoo', 'eng-rashford']),
    real: {
      score: { home: 1, away: 2 },
      decidedBy: 'AET',
      goals: [
        { minute: 36, teamId: 'NOR' },
        { minute: 45, teamId: 'ENG' },
        { minute: 93, teamId: 'ENG', extraTime: true },
      ],
      redCards: [],
      possession: { home: 47, away: 53 },
      shots: { home: { total: 13, onTarget: 5 }, away: { total: 14, onTarget: 8 } },
      note: 'Level 1–1 after 90 minutes; England struck the winner in extra time.',
    },
  },

  'qf-4': {
    id: 'qf-4',
    stage: 'Quarter-final',
    date: '2026-07-12',
    played: true,
    home: side('ARG', '4-4-2', [
      'arg-emartinez',
      'arg-molina', 'arg-romero', 'arg-lmartinez', 'arg-tagliafico',
      'arg-depaul', 'arg-paredes', 'arg-enzo', 'arg-macallister',
      'arg-messi', 'arg-alvarez',
    ], ['arg-almada', 'arg-jmlopez', 'arg-barco', 'arg-simeone']),
    away: side('SUI', '3-5-2', [
      'sui-kobel',
      'sui-elvedi', 'sui-akanji', 'sui-rodriguez',
      'sui-zakaria', 'sui-freuler', 'sui-xhaka', 'sui-rieder', 'sui-sow',
      'sui-ndoye', 'sui-embolo',
    ], ['sui-keller', 'sui-amdouni', 'sui-amenda', 'sui-jashari']),
    real: {
      score: { home: 3, away: 1 },
      decidedBy: 'AET',
      goals: [
        { minute: 10, teamId: 'ARG' },
        { minute: 67, teamId: 'SUI' },
        { minute: 112, teamId: 'ARG', extraTime: true },
        { minute: 120, teamId: 'ARG', extraTime: true },
      ],
      redCards: [],
      possession: { home: 59, away: 41 },
      shots: { home: { total: 23, onTarget: 7 }, away: { total: 13, onTarget: 5 } },
      note: 'Level 1–1 after 90 minutes; Argentina pulled away in extra time.',
    },
  },

  'sf-1': {
    id: 'sf-1',
    stage: 'Semi-final',
    date: '2026-07-14',
    played: true,
    home: side('FRA', '4-2-4', [
      'fra-maignan',
      'fra-kounde', 'fra-upamecano', 'fra-saliba', 'fra-digne',
      'fra-tchouameni', 'fra-rabiot',
      'fra-dembele', 'fra-olise', 'fra-barcola', 'fra-mbappe',
    ], ['fra-gusto', 'fra-akliouche', 'fra-zaire-emery', 'fra-doue']),
    away: side('ESP', '4-3-3', [
      'esp-simon',
      'esp-porro', 'esp-cubarsi', 'esp-laporte', 'esp-cucurella',
      'esp-rodri', 'esp-fabian', 'esp-baena',
      'esp-yamal', 'esp-oyarzabal', 'esp-olmo',
    ], ['esp-nico', 'esp-gavi', 'esp-pedri', 'esp-pubill']),
    real: {
      score: { home: 0, away: 2 },
      goals: [
        { minute: 22, teamId: 'ESP' },
        { minute: 58, teamId: 'ESP' },
      ],
      redCards: [],
      possession: { home: 49, away: 51 },
      shots: { home: { total: 14, onTarget: 4 }, away: { total: 10, onTarget: 2 } },
      note: 'Spain reach the final.',
    },
  },

  'sf-2': {
    id: 'sf-2',
    stage: 'Semi-final',
    date: '2026-07-15',
    played: true,
    home: side('ENG', '4-4-2', [
      'eng-pickford',
      'eng-rjames', 'eng-stones', 'eng-guehi', 'eng-spence',
      'eng-rice', 'eng-anderson', 'eng-rogers', 'eng-bellingham',
      'eng-gordon', 'eng-kane',
    ], ['eng-trafford', 'eng-eze', 'eng-mainoo', 'eng-oreilly']),
    away: side('ARG', '4-3-3', [
      'arg-emartinez',
      'arg-molina', 'arg-romero', 'arg-lmartinez', 'arg-tagliafico',
      'arg-paredes', 'arg-macallister', 'arg-enzo',
      'arg-simeone', 'arg-messi', 'arg-alvarez',
    ], ['arg-almada', 'arg-barco', 'arg-jmlopez', 'arg-nicopaz']),
    real: {
      score: { home: 1, away: 2 },
      goals: [
        { minute: 55, teamId: 'ENG' },
        { minute: 85, teamId: 'ARG' },
        { minute: 90, teamId: 'ARG' },
      ],
      redCards: [],
      yellowCards: [
        { minute: 37, teamId: 'ENG' },
        { minute: 42, teamId: 'ARG' },
        { minute: 51, teamId: 'ARG' },
        { minute: 90, teamId: 'ARG' },
      ],
      possession: { home: 36, away: 64 },
      shots: { home: { total: 6, onTarget: 3 }, away: { total: 14, onTarget: 6 } },
      note: 'Argentina reach the final.',
    },
  },

  'third-place': {
    id: 'third-place',
    stage: 'Third-place play-off',
    date: '2026-07-18',
    played: false,
    homeTeamId: 'FRA',
    awayTeamId: 'ENG',
    type: 'third-place',
  },

  final: {
    id: 'final',
    stage: 'Final',
    date: '2026-07-19',
    played: false,
    homeTeamId: 'ARG',
    awayTeamId: 'ESP',
  },
}

/** Bracket columns, ordered so adjacent pairs feed the next round's match. */
export const BRACKET_ROUNDS: { stage: StageName; matchIds: string[] }[] = [
  { stage: 'Round of 16', matchIds: ['r16-1', 'r16-2', 'r16-5', 'r16-6', 'r16-3', 'r16-4', 'r16-7', 'r16-8'] },
  { stage: 'Quarter-final', matchIds: ['qf-1', 'qf-2', 'qf-3', 'qf-4'] },
  { stage: 'Semi-final', matchIds: ['sf-1', 'sf-2'] },
  { stage: 'Final', matchIds: ['final'] },
]

export const PLAYED_MATCHES: PlayedMatch[] = Object.values(MATCHES).filter(
  (match): match is PlayedMatch => match.played,
)

export function getMatch(id: string | undefined): MatchDef | undefined {
  return id ? MATCHES[id] : undefined
}

/**
 * The anchor that ties a side to its results-fitted baseline: the baseline
 * itself plus the player-aggregate attack/defence of the REAL XI in the REAL
 * formation (the reference the engine divides by). Shared by real sheets and
 * user-edited sheets so identical lineups reproduce the baseline exactly.
 */
export function anchorFor(sideDef: MatchSideDef): NonNullable<TeamSheet['anchor']> {
  const slots = formationSlots(sideDef.formation)
  const realStarters = slots.map((slot, i) => ({ slot, player: getPlayer(sideDef.starters[i]) }))
  const reference = applyFormationEffect(
    computeTeamStrength(realStarters),
    FORMATIONS[sideDef.formation].modifiers,
  )
  const baseline = baselineFor(sideDef.teamId)
  return {
    attack: baseline.attack,
    defence: baseline.defence,
    reference: { attack: reference.attack, defence: reference.defence },
  }
}

/** Build the engine's TeamSheet for one side's real lineup. */
export function buildRealSheet(sideDef: MatchSideDef): TeamSheet {
  const team = TEAMS[sideDef.teamId]
  const slots = formationSlots(sideDef.formation)
  return {
    teamId: team.id,
    name: team.name,
    color: team.color,
    formation: sideDef.formation,
    modifiers: FORMATIONS[sideDef.formation].modifiers,
    anchor: anchorFor(sideDef),
    starters: slots.map((slot, i) => ({ slot, player: getPlayer(sideDef.starters[i]) })),
    bench: sideDef.bench.map(getPlayer),
  }
}
