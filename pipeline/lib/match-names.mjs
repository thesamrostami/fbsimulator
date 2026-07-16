/**
 * Name-matching helpers for the FC 26 player join. Exported separately so the
 * app's test suite can exercise normalization and similarity directly.
 */

/**
 * Lowercase, strip diacritics and punctuation, drop non-Latin script
 * (the FC 26 extract appends Arabic renderings directly onto Latin tokens),
 * collapse whitespace.
 */
export function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’\-–]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Jaro-Winkler similarity in [0,1]. */
export function jaroWinkler(a, b) {
  if (a === b) return 1
  const la = a.length
  const lb = b.length
  if (la === 0 || lb === 0) return 0
  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1)
  const matchA = new Array(la).fill(false)
  const matchB = new Array(lb).fill(false)
  let matches = 0
  for (let i = 0; i < la; i += 1) {
    const lo = Math.max(0, i - window)
    const hi = Math.min(lb - 1, i + window)
    for (let j = lo; j <= hi; j += 1) {
      if (!matchB[j] && a[i] === b[j]) {
        matchA[i] = true
        matchB[j] = true
        matches += 1
        break
      }
    }
  }
  if (matches === 0) return 0
  let transpositions = 0
  let k = 0
  for (let i = 0; i < la; i += 1) {
    if (!matchA[i]) continue
    while (!matchB[k]) k += 1
    if (a[i] !== b[k]) transpositions += 1
    k += 1
  }
  const jaro = (matches / la + matches / lb + (matches - transpositions / 2) / matches) / 3
  let prefix = 0
  for (let i = 0; i < Math.min(4, la, lb) && a[i] === b[i]; i += 1) prefix += 1
  return jaro + prefix * 0.1 * (1 - jaro)
}

/**
 * Score our roster name against an FC 26 candidate (normalized short + long
 * names). Our names are usually surnames ("Kane"), sometimes initial + surname
 * ("E. Martínez" → initial 'e'), sometimes multi-token ("Bruno Fernandes").
 *
 * Full tokens are aligned first (longest first), each consuming a DISTINCT
 * candidate token by best Jaro-Winkler; initials must then match the first
 * letter of a candidate token that is still unconsumed — so the "G." of
 * "G. Gómez" can never be satisfied by "Gómez" itself. Returns the mean
 * alignment similarity, or 0 when any token finds no home.
 */
export function scoreCandidate(ourName, candidateShort, candidateLong) {
  const ours = normalizeName(ourName).split(' ')
  const candTokens = [...new Set([...normalizeName(candidateLong).split(' '), ...normalizeName(candidateShort).split(' ')])]
  const used = new Set()
  const fullTokens = ours.filter((t) => t.length > 1).sort((a, b) => b.length - a.length)
  const initials = ours.filter((t) => t.length === 1)

  let total = 0
  for (const token of fullTokens) {
    let best = 0
    let bestIdx = -1
    for (let i = 0; i < candTokens.length; i += 1) {
      if (used.has(i)) continue
      const sim = jaroWinkler(token, candTokens[i])
      if (sim > best) {
        best = sim
        bestIdx = i
      }
    }
    if (best < 0.8) return 0
    used.add(bestIdx)
    total += best
  }
  for (const initial of initials) {
    const idx = candTokens.findIndex((c, i) => !used.has(i) && c.startsWith(initial))
    if (idx === -1) return 0
    used.add(idx)
  }
  return fullTokens.length === 0 ? 0.9 : total / fullTokens.length
}

/** Map an FC 26 primary position to our line schema. */
export function fc26Line(playerPositions) {
  const pos = (playerPositions ?? '').split(',')[0].trim()
  if (pos === 'GK') return 'GK'
  if (/^(CB|RB|LB|RWB|LWB)$/.test(pos)) return 'DEF'
  if (/^(CDM|CM|CAM|RM|LM)$/.test(pos)) return 'MID'
  if (/^(RW|LW|ST|CF)$/.test(pos)) return 'FWD'
  return 'MID'
}
