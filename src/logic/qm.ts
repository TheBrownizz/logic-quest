/** mask bit 1 = variable present; value gives its polarity. Bit (n-1-i) is inputs[i]. */
export type Term = { mask: number; value: number }

function popcount(x: number): number {
  let c = 0
  while (x) {
    c += x & 1
    x >>>= 1
  }
  return c
}

export function literalCount(terms: Term[]): number {
  return terms.reduce((s, t) => s + popcount(t.mask), 0)
}

export function formatSOP(terms: Term[], inputs: string[]): string {
  if (terms.length === 0) return '0'
  const n = inputs.length
  return terms
    .map(t => {
      if (t.mask === 0) return '1'
      let s = ''
      for (let i = 0; i < n; i++) {
        const bit = 1 << (n - 1 - i)
        if (t.mask & bit) s += inputs[i] + (t.value & bit ? '' : "'")
      }
      return s
    })
    .join(' + ')
}

const covers = (t: Term, m: number) => (m & t.mask) === t.value
const sortTerms = (ts: Term[]) => ts.sort((a, b) => a.mask - b.mask || a.value - b.value)

export function primeImplicants(
  nVars: number,
  minterms: number[],
  dontCares: number[] = [],
): Term[] {
  const full = (1 << nVars) - 1
  const care = new Set(minterms)
  let current = new Map<string, Term>()
  for (const m of new Set([...minterms, ...dontCares])) {
    current.set(`${full}:${m}`, { mask: full, value: m })
  }
  const primes: Term[] = []
  while (current.size > 0) {
    const terms = [...current.values()]
    const used = new Set<string>()
    const next = new Map<string, Term>()
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const a = terms[i], b = terms[j]
        if (a.mask !== b.mask) continue
        const diff = a.value ^ b.value
        if (diff === 0 || (diff & (diff - 1)) !== 0) continue
        used.add(`${a.mask}:${a.value}`)
        used.add(`${b.mask}:${b.value}`)
        const mask = a.mask & ~diff
        const value = a.value & mask
        next.set(`${mask}:${value}`, { mask, value })
      }
    }
    for (const t of terms) {
      if (!used.has(`${t.mask}:${t.value}`)) primes.push(t)
    }
    current = next
  }
  // drop PIs that cover only don't-cares
  const out = primes.filter(t => {
    for (const m of care) if (covers(t, m)) return true
    return false
  })
  return sortTerms(out)
}

export function minimizeSOP(
  nVars: number,
  minterms: number[],
  dontCares: number[] = [],
): Term[] {
  const ms = [...new Set(minterms)]
  if (ms.length === 0) return []
  const pis = primeImplicants(nVars, ms, dontCares)
  const chosen: Term[] = []
  let remaining = ms

  // essential prime implicants
  const essential = new Set<Term>()
  for (const m of ms) {
    const c = pis.filter(t => covers(t, m))
    if (c.length === 1) essential.add(c[0])
  }
  for (const t of essential) chosen.push(t)
  remaining = remaining.filter(m => !chosen.some(t => covers(t, m)))

  if (remaining.length > 0) {
    const cands = pis.filter(t => !essential.has(t))
    let best: Term[] | null = null
    const cost = (ts: Term[]) => ts.length * 1000 + literalCount(ts)
    const search = (uncovered: number[], picked: Term[]) => {
      if (best && cost(picked) >= cost(best)) return
      if (uncovered.length === 0) {
        best = [...picked]
        return
      }
      // branch on the uncovered minterm with fewest covering candidates
      let pivotOpts: Term[] | null = null
      for (const m of uncovered) {
        const opts = cands.filter(t => covers(t, m))
        if (!pivotOpts || opts.length < pivotOpts.length) {
          pivotOpts = opts
        }
      }
      for (const t of pivotOpts ?? []) {
        picked.push(t)
        search(uncovered.filter(m => !covers(t, m)), picked)
        picked.pop()
      }
    }
    search(remaining, [])
    chosen.push(...(best ?? []))
  }
  return sortTerms(chosen)
}
