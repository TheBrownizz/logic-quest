import { minimizeSOP, literalCount, formatSOP, type Term } from './qm'

const GRAY = [0, 1, 3, 2]

function grayOf(bits: number): number[] {
  return bits === 0 ? [0] : bits === 1 ? [0, 1] : GRAY
}

function rowBits(n: number): number {
  return Math.floor(n / 2)
}

export function kmapLayout(nVars: 2 | 3 | 4): {
  rows: number
  cols: number
  mintermAt(r: number, c: number): number
} {
  const rb = rowBits(nVars)
  const cb = nVars - rb
  const rg = grayOf(rb)
  const cg = grayOf(cb)
  return {
    rows: 1 << rb,
    cols: 1 << cb,
    mintermAt: (r, c) => (rg[r] << cb) | cg[c],
  }
}

export type Group = { cells: Array<[number, number]> }

/** Minterms of the cells of a group, or null if a cell is out of range. */
function cellMinterms(nVars: number, g: Group): number[] | null {
  const L = kmapLayout(nVars as 2 | 3 | 4)
  const out: number[] = []
  for (const [r, c] of g.cells) {
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= L.rows || c >= L.cols) return null
    out.push(L.mintermAt(r, c))
  }
  return out
}

export function groupToTerm(nVars: 2 | 3 | 4, g: Group): Term | null {
  const ms = cellMinterms(nVars, g)
  if (!ms || ms.length === 0) return null
  if (new Set(ms).size !== ms.length) return null
  const n = ms.length
  if ((n & (n - 1)) !== 0) return null
  const full = (1 << nVars) - 1
  let and = full
  let or = 0
  for (const m of ms) {
    and &= m
    or |= m
  }
  const varying = or & ~and
  // a cube of 2^k cells has exactly k varying bits and all distinct cells
  let k = 0
  for (let x = varying; x; x &= x - 1) k++
  if (1 << k !== n) return null
  const mask = full & ~varying
  return { mask, value: and & mask }
}

export function checkCover(
  nVars: 2 | 3 | 4,
  minterms: number[],
  dontCares: number[],
  groups: Group[],
): { valid: boolean; covered: boolean; coversZero: boolean; isMinimal: boolean; expression: string } {
  const care = new Set(minterms)
  const ok = new Set([...minterms, ...dontCares])
  const inGroup = new Set<number>()
  let valid = true
  let coversZero = false
  const terms: Term[] = []
  for (const g of groups) {
    const t = groupToTerm(nVars, g)
    if (!t) {
      valid = false
      continue
    }
    terms.push(t)
    for (const m of cellMinterms(nVars, g)!) {
      inGroup.add(m)
      if (!ok.has(m)) coversZero = true
    }
  }
  const covered = [...care].every(m => inGroup.has(m))
  let isMinimal = false
  if (valid && covered && !coversZero) {
    const best = minimizeSOP(nVars, minterms, dontCares)
    isMinimal =
      terms.length === best.length && literalCount(terms) === literalCount(best)
  }
  const names = ['A', 'B', 'C', 'D'].slice(0, nVars)
  return { valid, covered, coversZero, isMinimal, expression: formatSOP(terms, names) }
}
