export type Bit = 0 | 1
export type Out = 0 | 1 | 'x'

/** rows[i][j] = output j at input index i; inputs[0] is the MSB of i. */
export interface TruthTable {
  inputs: string[]
  outputs: string[]
  rows: Out[][]
}

export function tableFromMinterms(
  inputs: string[],
  minterms: number[],
  dontCares: number[] = [],
): TruthTable {
  const size = 1 << inputs.length
  const ms = new Set(minterms)
  const ds = new Set(dontCares)
  const rows: Out[][] = []
  for (let i = 0; i < size; i++) {
    rows.push([ms.has(i) ? 1 : ds.has(i) ? 'x' : 0])
  }
  return { inputs: [...inputs], outputs: ['F'], rows }
}

/** Checks `actual` against `spec`; 'x' entries in spec are ignored. */
export function matches(
  spec: TruthTable,
  actual: TruthTable,
): { ok: boolean; firstMismatch?: { row: number; output: string } } {
  for (let i = 0; i < spec.rows.length; i++) {
    for (let j = 0; j < spec.outputs.length; j++) {
      const want = spec.rows[i][j]
      if (want === 'x') continue
      if (actual.rows[i]?.[j] !== want) {
        return { ok: false, firstMismatch: { row: i, output: spec.outputs[j] } }
      }
    }
  }
  return { ok: true }
}
