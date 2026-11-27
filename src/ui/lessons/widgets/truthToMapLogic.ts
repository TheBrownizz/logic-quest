import { groupToTerm, kmapLayout } from '../../../logic/kmap'
import { formatSOP } from '../../../logic/qm'

/**
 * TruthToMap (spec 6.4.7): truth-table rows fly to their Karnaugh-map cells (Gray order), and the map shows which
 * cells are neighbours, wrap-around included. A second view ('rows') keeps only the truth table: selecting a row
 * writes that row's minterm (or maxterm), which teaches canonical SOP and POS. Pure logic, no DOM.
 */

export interface TruthToMapConfig {
  /** 2–4; variables are A, B, C, D (A most significant), as in the k-map rooms. */
  nVars: 2 | 3 | 4
  minterms: number[]
  dontCares?: number[]
  /**
   * 'flow' (default): truth table and map; rows fly to their cells and cells can be selected.
   * 'rows': a truth table only; selecting a row writes its minterm or maxterm and `picked` holds the selected rows.
   */
  view?: 'flow' | 'rows'
  /** 'flow' view: the map starts filled (all rows already placed), for steps that are about selecting cells. */
  startPlaced?: boolean
  /** 'rows' view: what a selected row writes. 'sop' (default): its minterm, joined with +. 'pos': its maxterm, joined as a product. */
  terms?: 'sop' | 'pos'
  /** 'flow' view: show whether the selected cells form a legal group, and the term that group gives. */
  groups?: boolean
}
export interface TruthToMapState {
  /** Rows (minterm numbers) already moved onto the map. */
  placed: number[]
  /** Map cells (minterm numbers) the player has selected. In the 'rows' view: the selected rows. */
  picked: number[]
}
export type TruthToMapGoal =
  /** Move every row onto the map. */
  | { kind: 'all-placed' }
  /** Select exactly these cells (e.g. the neighbours of a cell, or a valid group). */
  | { kind: 'pick'; cells: number[] }

export const VAR_NAMES = ['A', 'B', 'C', 'D'] as const

export const rowCount = (c: Pick<TruthToMapConfig, 'nVars'>) => 1 << c.nVars
export const allRows = (c: Pick<TruthToMapConfig, 'nVars'>) => Array.from({ length: rowCount(c) }, (_, i) => i)

export function initial(c: TruthToMapConfig): TruthToMapState {
  return { placed: c.startPlaced && (c.view ?? 'flow') === 'flow' ? allRows(c) : [], picked: [] }
}

const sameSet = (a: number[], b: number[]) => {
  const x = new Set(a)
  const y = new Set(b)
  return x.size === y.size && [...x].every(v => y.has(v))
}

export function isGoalMet(s: TruthToMapState, g: TruthToMapGoal, c: TruthToMapConfig): boolean {
  if (!s || !Array.isArray(s.placed) || !Array.isArray(s.picked)) return false
  if (g.kind === 'all-placed') {
    const have = new Set(s.placed)
    return allRows(c).every(m => have.has(m))
  }
  return sameSet(s.picked, g.cells)
}

/** The state the widget shows when the step is already complete: the goal reached. */
export function finalState(c: TruthToMapConfig, g: TruthToMapGoal | undefined): TruthToMapState {
  if (!g) return initial(c)
  if ((c.view ?? 'flow') === 'rows') return { placed: [], picked: g.kind === 'pick' ? [...g.cells] : [] }
  return { placed: allRows(c), picked: g.kind === 'pick' ? [...g.cells] : [] }
}

/** F at row m: 1, 0 or 'x' (don't care). */
export function valueAt(c: TruthToMapConfig, m: number): 0 | 1 | 'x' {
  if (c.minterms.includes(m)) return 1
  if (c.dontCares?.includes(m)) return 'x'
  return 0
}

/** The bits of row m, most significant (A) first. */
export const bitsOf = (n: number, m: number) => m.toString(2).padStart(n, '0')

/** The map cell (row, column) that holds minterm m. */
export function cellOf(n: 2 | 3 | 4, m: number): [number, number] {
  const L = kmapLayout(n)
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) if (L.mintermAt(r, c) === m) return [r, c]
  throw new RangeError(`minterm ${m} is not on a ${n}-variable map`)
}

/** Header labels of the map: the bits of the row variables per map row, and of the column variables per map column (Gray order). */
export function mapHeaders(n: 2 | 3 | 4): { rows: string[]; cols: string[]; rowVars: string; colVars: string } {
  const L = kmapLayout(n)
  const cb = Math.log2(L.cols)
  const rb = Math.log2(L.rows)
  return {
    rows: Array.from({ length: L.rows }, (_, r) => bitsOf(rb, L.mintermAt(r, 0) >> cb)),
    cols: Array.from({ length: L.cols }, (_, c) => bitsOf(cb, L.mintermAt(0, c) & ((1 << cb) - 1))),
    rowVars: VAR_NAMES.slice(0, rb).join(''),
    colVars: VAR_NAMES.slice(rb, n).join(''),
  }
}

export interface Neighbour { m: number; /** the variable in which the two cells differ */ varName: string; /** the cells are not side by side on the map: they meet across its edge */ wraps: boolean }

/** Every cell that differs from m in exactly one variable. On the map they are the side-by-side cells and the ones across the edge. */
export function neighbours(n: 2 | 3 | 4, m: number): Neighbour[] {
  const [r0, c0] = cellOf(n, m)
  const out: Neighbour[] = []
  for (let i = 0; i < n; i++) {
    const other = m ^ (1 << (n - 1 - i))
    const [r1, c1] = cellOf(n, other)
    out.push({ m: other, varName: VAR_NAMES[i], wraps: Math.abs(r1 - r0) > 1 || Math.abs(c1 - c0) > 1 })
  }
  return out.sort((a, b) => a.m - b.m)
}

/** The minterm (product) of row m: a variable is plain where the row has 1 and primed where it has 0. */
export function mintermTerm(n: number, m: number): string {
  return VAR_NAMES.slice(0, n).map((v, i) => (m & (1 << (n - 1 - i)) ? v : `${v}'`)).join('')
}

/** The maxterm (sum) of row m: the opposite rule, a variable is plain where the row has 0 and primed where it has 1. */
export function maxtermTerm(n: number, m: number): string {
  return `(${VAR_NAMES.slice(0, n).map((v, i) => (m & (1 << (n - 1 - i)) ? `${v}'` : v)).join(' + ')})`
}

/** The expression the selected rows write in the 'rows' view, e.g. "F = A'BC + AB'C" or "F = (A + B + C)(A + B + C')". */
export function rowsExpression(n: number, picked: number[], style: 'sop' | 'pos'): string {
  const ms = [...new Set(picked)].sort((a, b) => a - b)
  if (ms.length === 0) return 'F = …'
  return style === 'pos'
    ? `F = ${ms.map(m => maxtermTerm(n, m)).join('')}`
    : `F = ${ms.map(m => mintermTerm(n, m)).join(' + ')}`
}

/** Whether the selected cells are one legal group (2^k cells forming a rectangle, edges included), and the term it gives. */
export function groupInfo(n: 2 | 3 | 4, picked: number[]): { valid: boolean; term: string } {
  const cells = picked.map(m => cellOf(n, m))
  const t = groupToTerm(n, { cells })
  return t ? { valid: true, term: formatSOP([t], [...VAR_NAMES.slice(0, n)]) } : { valid: false, term: '' }
}

export const toggle = (list: number[], m: number) => (list.includes(m) ? list.filter(x => x !== m) : [...list, m])
