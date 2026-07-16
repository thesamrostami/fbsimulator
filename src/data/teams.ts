/**
 * The 16 knockout-stage teams. Two colors per team: `color` is the bright
 * accent for text/glow/borders; `chartColor` is the darker mark color for
 * charts. Every pairing that actually shares a chart (the 13 played matches)
 * was validated with the dataviz palette checker against the dark surface
 * (#081a10): lightness band, chroma floor, CVD separation, normal-vision
 * floor and contrast all pass.
 */

export type TeamId =
  | 'PAR'
  | 'FRA'
  | 'CAN'
  | 'MAR'
  | 'BRA'
  | 'NOR'
  | 'MEX'
  | 'ENG'
  | 'POR'
  | 'ESP'
  | 'USA'
  | 'BEL'
  | 'ARG'
  | 'EGY'
  | 'SUI'
  | 'COL'

export interface TeamInfo {
  id: TeamId
  name: string
  shortName: string
  color: string
  chartColor: string
}

export const TEAMS: Record<TeamId, TeamInfo> = {
  PAR: { id: 'PAR', name: 'Paraguay', shortName: 'PAR', color: '#f0707a', chartColor: '#e05c66' },
  FRA: { id: 'FRA', name: 'France', shortName: 'FRA', color: '#6b8ffc', chartColor: '#4a72e8' },
  CAN: { id: 'CAN', name: 'Canada', shortName: 'CAN', color: '#e05555', chartColor: '#b83d3d' },
  MAR: { id: 'MAR', name: 'Morocco', shortName: 'MAR', color: '#4cc973', chartColor: '#3fae5c' },
  BRA: { id: 'BRA', name: 'Brazil', shortName: 'BRA', color: '#e6c235', chartColor: '#ac8b16' },
  NOR: { id: 'NOR', name: 'Norway', shortName: 'NOR', color: '#ef5f70', chartColor: '#c94856' },
  MEX: { id: 'MEX', name: 'Mexico', shortName: 'MEX', color: '#2fbf71', chartColor: '#1fa860' },
  ENG: { id: 'ENG', name: 'England', shortName: 'ENG', color: '#5aa9ff', chartColor: '#4a8fe0' },
  POR: { id: 'POR', name: 'Portugal', shortName: 'POR', color: '#ea5f5f', chartColor: '#cc4444' },
  ESP: { id: 'ESP', name: 'Spain', shortName: 'ESP', color: '#f2c531', chartColor: '#b98c12' },
  USA: { id: 'USA', name: 'United States', shortName: 'USA', color: '#7b9ff2', chartColor: '#5a7fd6' },
  BEL: { id: 'BEL', name: 'Belgium', shortName: 'BEL', color: '#e65555', chartColor: '#c73a3a' },
  ARG: { id: 'ARG', name: 'Argentina', shortName: 'ARG', color: '#58bef7', chartColor: '#3f9fd6' },
  EGY: { id: 'EGY', name: 'Egypt', shortName: 'EGY', color: '#f26666', chartColor: '#d94848' },
  SUI: { id: 'SUI', name: 'Switzerland', shortName: 'SUI', color: '#e55151', chartColor: '#c13a3a' },
  COL: { id: 'COL', name: 'Colombia', shortName: 'COL', color: '#e8bc3d', chartColor: '#b58f1f' },
}

export function isTeamId(id: string | undefined): id is TeamId {
  return id !== undefined && id in TEAMS
}
