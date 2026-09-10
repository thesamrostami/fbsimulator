/** Seedable PRNG (mulberry32). Deterministic for a given seed across platforms. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next: () => number
  /** True with probability p. */
  chance: (p: number) => boolean
  /** Uniform pick from a non-empty array. */
  pick: <T>(items: readonly T[]) => T
  /** Weighted pick; weights must be non-negative and not all zero. */
  weightedPick: <T>(items: readonly T[], weight: (item: T) => number) => T
  /** Index into a precomputed non-negative weight array (uniform if all zero). One draw. */
  weightedIndex: (weights: ArrayLike<number>) => number
  /** Standard normal draw (Box-Muller). Two draws. */
  gaussian: () => number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty array')
      return items[Math.floor(next() * items.length)]
    },
    weightedIndex: (weights) => {
      const n = weights.length
      if (n === 0) throw new Error('weightedIndex over empty weights')
      let total = 0
      for (let i = 0; i < n; i++) total += weights[i]
      if (total <= 0) return Math.floor(next() * n)
      let roll = next() * total
      for (let i = 0; i < n; i++) {
        roll -= weights[i]
        if (roll <= 0) return i
      }
      return n - 1
    },
    gaussian: () => {
      const u = Math.max(next(), 1e-12)
      const v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    weightedPick: (items, weight) => {
      if (items.length === 0) throw new Error('weightedPick from empty array')
      const total = items.reduce((sum, item) => sum + weight(item), 0)
      if (total <= 0) return items[Math.floor(next() * items.length)]
      let roll = next() * total
      for (const item of items) {
        roll -= weight(item)
        if (roll <= 0) return item
      }
      return items[items.length - 1]
    },
  }
}
