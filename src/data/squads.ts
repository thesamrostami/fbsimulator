import type { TeamId } from './teams'

/**
 * Verified 2026 World Cup squads (26 players), ordered GK → DEF → MID → FWD.
 * Every squad below was cross-checked against at least two of the listed
 * sources on 2026-07-15. Players who featured in the knockout matches keep
 * their original entries in players.ts; discrepancies between our featured
 * match data and the squad lists are noted per team and the featured data
 * wins (those players demonstrably played).
 *
 * Hard rule honoured: no invented names. If a squad ever fails verification,
 * set verified: false — the editor then shows a "partial bench" notice and
 * falls back to the featured-players bench.
 */

export interface SquadInfo {
  teamId: TeamId
  /** Player ids, grouped GK → DEF → MID → FWD. */
  players: string[]
  verified: boolean
  sources: string[]
  /** Data caveat surfaced in the report (and available to the UI). */
  note?: string
}

export const SQUADS: Record<TeamId, SquadInfo> = {
  ENG: {
    teamId: 'ENG',
    verified: true,
    sources: ['ESPN', 'WorldCupWiki', 'englandfootball.com (via search)'],
    note: 'Livramento withdrew injured on 16 June and was replaced by Chalobah.',
    players: [
      'eng-pickford', 'eng-dhenderson', 'eng-trafford',
      'eng-konsa', 'eng-stones', 'eng-guehi', 'eng-quansah', 'eng-oreilly', 'eng-burn', 'eng-rjames', 'eng-spence', 'eng-chalobah',
      'eng-anderson', 'eng-rice', 'eng-bellingham', 'eng-eze', 'eng-mainoo', 'eng-rogers', 'eng-jhenderson',
      'eng-saka', 'eng-kane', 'eng-gordon', 'eng-madueke', 'eng-rashford', 'eng-watkins', 'eng-toney',
    ],
  },
  MEX: {
    teamId: 'MEX',
    verified: true,
    sources: ['MercatoWire', 'Yahoo Sports / Olympics.com (via search)'],
    note: 'Squad lists group Vargas (Obed) as a midfielder; he featured as a forward in our match data, which wins.',
    players: [
      'mex-rangel', 'mex-acevedo', 'mex-ochoa',
      'mex-sanchez', 'mex-montes', 'mex-vasquez', 'mex-gallardo', 'mex-reyes', 'mex-ealvarez', 'mex-mateo-chavez',
      'mex-lira', 'mex-mora', 'mex-romo', 'mex-gutierrez', 'mex-chavez', 'mex-fidalgo', 'mex-pineda',
      'mex-alvarado', 'mex-jimenez', 'mex-quinones', 'mex-vargas', 'mex-vega', 'mex-gimenez', 'mex-agonzalez', 'mex-huerta', 'mex-gmartinez',
    ],
  },
  FRA: {
    teamId: 'FRA',
    verified: true,
    sources: ['Get French Football News / Yahoo (via search)', 'WorldCupWiki'],
    players: [
      'fra-maignan', 'fra-risser', 'fra-samba',
      'fra-kounde', 'fra-upamecano', 'fra-saliba', 'fra-digne', 'fra-gusto', 'fra-konate', 'fra-lhernandez', 'fra-thernandez', 'fra-lacroix',
      'fra-kone', 'fra-rabiot', 'fra-tchouameni', 'fra-zaire-emery', 'fra-kante', 'fra-cherki',
      'fra-dembele', 'fra-olise', 'fra-barcola', 'fra-mbappe', 'fra-doue', 'fra-akliouche', 'fra-mateta', 'fra-thuram',
    ],
  },
  PAR: {
    teamId: 'PAR',
    verified: true,
    sources: ['MercatoWire', 'FourFourTwo (via search)'],
    players: [
      'par-gill', 'par-fernandez', 'par-olveira',
      'par-caceres', 'par-velazquez', 'par-g-gomez', 'par-alderete', 'par-alonso', 'par-balbuena', 'par-canale', 'par-maidana',
      'par-almiron', 'par-d-gomez', 'par-cubas', 'par-galarza', 'par-sosa', 'par-mauricio', 'par-ojeda', 'par-romero',
      'par-enciso', 'par-bobadilla', 'par-arce', 'par-sanabria', 'par-avalos', 'par-caballero', 'par-pitta',
    ],
  },
  CAN: {
    teamId: 'CAN',
    verified: true,
    sources: ['WorldCupWiki', 'MercatoWire (24 of 26; Johnston also confirmed by match data)'],
    players: [
      'can-crepeau', 'can-goodman', 'can-stclair',
      'can-johnston', 'can-bombito', 'can-defougerolles', 'can-laryea', 'can-sigur', 'can-p-david', 'can-jones', 'can-waterman', 'can-cornelius', 'can-davies',
      'can-eustaquio', 'can-osorio', 'can-choiniere', 'can-ikone', 'can-nsaliba', 'can-flores',
      'can-buchanan', 'can-ahmed', 'can-david', 'can-oluwaseyi', 'can-millar', 'can-shaffelburg', 'can-larin',
    ],
  },
  MAR: {
    teamId: 'MAR',
    verified: true,
    sources: ['MercatoWire', 'WorldCupWiki'],
    note: 'Featured sub Sbai is not on either 26-man list; he is kept (he appeared on a real bench), making 27 available players.',
    players: [
      'mar-bounou', 'mar-elkajoui', 'mar-tagnaouti',
      'mar-hakimi', 'mar-halhal', 'mar-diop', 'mar-mazraoui', 'mar-salaheddine', 'mar-sbai', 'mar-aguerd', 'mar-elouahdi', 'mar-riad', 'mar-belammari',
      'mar-bouaddi', 'mar-elaynaoui', 'mar-ounahi', 'mar-elkhannouss', 'mar-saibari', 'mar-talbi', 'mar-elmourabet', 'mar-amrabat',
      'mar-brahim', 'mar-rahimi', 'mar-yassine', 'mar-elkaabi', 'mar-ezzalzouli', 'mar-amaimouni',
    ],
  },
  BRA: {
    teamId: 'BRA',
    verified: true,
    sources: ['MercatoWire', 'WorldCupWiki'],
    players: [
      'bra-alisson', 'bra-weverton', 'bra-ederson',
      'bra-danilo', 'bra-marquinhos', 'bra-gabriel', 'bra-douglas', 'bra-danilo-santos', 'bra-wesley', 'bra-alexsandro', 'bra-bremer', 'bra-leopereira', 'bra-ibanez',
      'bra-bruno', 'bra-casemiro', 'bra-fabinho', 'bra-paqueta',
      'bra-rayan', 'bra-martinelli', 'bra-vinicius', 'bra-cunha', 'bra-endrick', 'bra-luiz-henrique', 'bra-igor-thiago', 'bra-neymar', 'bra-raphinha',
    ],
  },
  NOR: {
    teamId: 'NOR',
    verified: true,
    sources: ['MercatoWire', 'WorldCupWiki'],
    players: [
      'nor-nyland', 'nor-tangvik', 'nor-selvik',
      'nor-ryerson', 'nor-ajer', 'nor-heggem', 'nor-wolfe', 'nor-falchener', 'nor-langas', 'nor-ostigard', 'nor-bjorkan', 'nor-pedersen',
      'nor-berge', 'nor-odegaard', 'nor-berg', 'nor-schjelderup', 'nor-thorsby', 'nor-aursnes', 'nor-thorstvedt', 'nor-aasgaard',
      'nor-sorloth', 'nor-haaland', 'nor-nusa', 'nor-bobb', 'nor-larsen', 'nor-hauge',
    ],
  },
  POR: {
    teamId: 'POR',
    verified: true,
    sources: ['MercatoWire', 'FourFourTwo / Al Jazeera (via search)'],
    note: 'Martínez initially named 27 with a fourth keeper (Velho); trimmed to this 26 by the 2 June deadline.',
    players: [
      'por-costa', 'por-sa', 'por-ruisilva',
      'por-cancelo', 'por-dias', 'por-veiga', 'por-mendes', 'por-inacio', 'por-semedo', 'por-araujo', 'por-dalot',
      'por-neves', 'por-vitinha', 'por-bruno', 'por-samu-costa', 'por-nunes', 'por-bernardo', 'por-rneves',
      'por-neto', 'por-felix', 'por-ronaldo', 'por-conceicao', 'por-ramos', 'por-trincao', 'por-leao', 'por-guedes',
    ],
  },
  ESP: {
    teamId: 'ESP',
    verified: true,
    sources: ['MercatoWire', 'ESPN / Goal.com (via search)'],
    players: [
      'esp-simon', 'esp-raya', 'esp-jgarcia',
      'esp-porro', 'esp-cubarsi', 'esp-laporte', 'esp-cucurella', 'esp-pubill', 'esp-grimaldo', 'esp-egarcia',
      'esp-rodri', 'esp-pedri', 'esp-baena', 'esp-fabian', 'esp-zubimendi', 'esp-gavi', 'esp-llorente', 'esp-merino',
      'esp-yamal', 'esp-olmo', 'esp-oyarzabal', 'esp-nico', 'esp-vmunoz', 'esp-pino', 'esp-ferran', 'esp-iglesias',
    ],
  },
  USA: {
    teamId: 'USA',
    verified: true,
    sources: ['WorldCupWiki', 'ussoccer.com / CBS Sports (via search)'],
    players: [
      'usa-freese', 'usa-brady', 'usa-turner',
      'usa-freeman', 'usa-richards', 'usa-ream', 'usa-dest', 'usa-robinson', 'usa-arfsten', 'usa-mckenzie', 'usa-mrobinson', 'usa-trusty', 'usa-scally',
      'usa-mckennie', 'usa-adams', 'usa-tillman', 'usa-berhalter', 'usa-roldan', 'usa-reyna',
      'usa-pulisic', 'usa-balogun', 'usa-zendejas', 'usa-pepi', 'usa-weah', 'usa-wright', 'usa-aaronson',
    ],
  },
  BEL: {
    teamId: 'BEL',
    verified: true,
    sources: ['MercatoWire', 'WorldCupWiki'],
    players: [
      'bel-courtois', 'bel-penders', 'bel-lammens',
      'bel-castagne', 'bel-ngoy', 'bel-mechele', 'bel-decuyper', 'bel-dewinter', 'bel-debast', 'bel-seys', 'bel-theate', 'bel-meunier',
      'bel-onana', 'bel-tielemans', 'bel-raskin', 'bel-witsel', 'bel-vanaken', 'bel-debruyne',
      'bel-trossard', 'bel-lukebakio', 'bel-dekete', 'bel-doku', 'bel-moreira', 'bel-fpardo', 'bel-lukaku', 'bel-saelemaekers',
    ],
  },
  ARG: {
    teamId: 'ARG',
    verified: true,
    sources: ['MercatoWire', 'WorldCupWiki'],
    players: [
      'arg-emartinez', 'arg-musso', 'arg-rulli',
      'arg-molina', 'arg-romero', 'arg-lmartinez', 'arg-tagliafico', 'arg-barco', 'arg-balerdi', 'arg-montiel', 'arg-otamendi', 'arg-medina',
      'arg-paredes', 'arg-depaul', 'arg-enzo', 'arg-macallister', 'arg-nicopaz', 'arg-almada', 'arg-locelso', 'arg-palacios',
      'arg-messi', 'arg-alvarez', 'arg-simeone', 'arg-jmlopez', 'arg-ngonzalez', 'arg-lautaro',
    ],
  },
  EGY: {
    teamId: 'EGY',
    verified: true,
    sources: ['WorldCupWiki', 'Al Jazeera / Soccergraph (via search)'],
    players: [
      'egy-shoubir', 'egy-alaa', 'egy-elshenawy', 'egy-soliman',
      'egy-hany', 'egy-rabia', 'egy-ibrahim', 'egy-hafez', 'egy-abdelmaguid', 'egy-fatouh', 'egy-abdelmonem',
      'egy-attia', 'egy-lashin', 'egy-ashour', 'egy-zico', 'egy-tarekalaa', 'egy-fathy', 'egy-donga',
      'egy-salah', 'egy-hassan', 'egy-saber', 'egy-zizo', 'egy-marmoush', 'egy-trezeguet', 'egy-adel', 'egy-abdelkarim',
    ],
  },
  SUI: {
    teamId: 'SUI',
    verified: true,
    sources: ['MercatoWire', 'WorldCupPass'],
    players: [
      'sui-kobel', 'sui-keller', 'sui-mvogo',
      'sui-elvedi', 'sui-akanji', 'sui-rodriguez', 'sui-amenda', 'sui-comert', 'sui-muheim', 'sui-widmer', 'sui-jaquez',
      'sui-zakaria', 'sui-jashari', 'sui-xhaka', 'sui-freuler', 'sui-rieder', 'sui-sow', 'sui-manzambi', 'sui-aebischer',
      'sui-ndoye', 'sui-embolo', 'sui-amdouni', 'sui-rvargas', 'sui-fassnacht', 'sui-okafor', 'sui-itten',
    ],
  },
  COL: {
    teamId: 'COL',
    verified: true,
    sources: ['WorldCupPass', 'FIFA / Heavy.com (via search)'],
    players: [
      'col-vargas', 'col-ospina', 'col-montero',
      'col-munoz', 'col-dsanchez', 'col-lucumi', 'col-mojica', 'col-puerta', 'col-ditta', 'col-sarias', 'col-mina', 'col-machado',
      'col-lerma', 'col-arias', 'col-james', 'col-castano', 'col-portilla', 'col-rios', 'col-carrascal', 'col-quintero', 'col-campaz',
      'col-suarez', 'col-diaz', 'col-cordoba', 'col-cgomez', 'col-cucho',
    ],
  },
}
