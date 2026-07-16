import type { LineupState, SideKey } from './appState'

/**
 * Session-scoped record of the last simulation per match: the seed plus the
 * exact lineups it ran with. Simulations are deterministic, so this is all
 * that's needed to re-derive the identical sim (and its match report) when
 * the user navigates away and back. Module-level → survives route changes,
 * cleared on reload.
 */
export interface StoredSim {
  seed: number
  lineups: Record<SideKey, LineupState>
}

const sims = new Map<string, StoredSim>()

export const sessionSims = {
  get: (matchId: string): StoredSim | undefined => sims.get(matchId),
  set: (matchId: string, stored: StoredSim): void => {
    sims.set(matchId, stored)
  },
}
