import type { MatchScript } from '../services/matchScript'

/**
 * The last simulation of each match this session, as its script: seed,
 * kick-off lineups and every confirmed change. Scripts replay byte for byte
 * (see services/matchScript), so this is all a result page needs to come
 * back — and being plain data, it survives a reload via sessionStorage.
 */

const KEY = 'replay-cup-session-sims'

function load(): Map<string, MatchScript> {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, MatchScript>))
  } catch {
    // No storage, or a stale shape: start empty.
  }
  return new Map()
}

const memory: Map<string, MatchScript> = typeof window === 'undefined' ? new Map() : load()

function persist(): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(memory)))
  } catch {
    // Best effort: the in-memory copy still works for this page.
  }
}

export const sessionSims = {
  get(matchId: string): MatchScript | undefined {
    return memory.get(matchId)
  },
  set(matchId: string, script: MatchScript): void {
    memory.set(matchId, script)
    persist()
  },
  clear(): void {
    memory.clear()
    persist()
  },
}
