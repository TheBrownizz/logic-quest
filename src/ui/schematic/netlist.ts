/**
 * A small schematic netlist, written by content and drawn by layoutSchematic (geometry.ts) + <Schematic>.
 * Parts sit on a grid: `at: [column, row]` (fractions allowed, e.g. row 0.5 to centre between two rows).
 * Signals flow left to right; a wire into a part to the left of its source is routed around as feedback.
 *
 * Pins (a wire end is "partId" for the part's only/default pin, or "partId.pin"):
 * - gates: inputs "0", "1", "2" (top to bottom), output "out" (default for `from`).
 * - `in` terminal: output only (default). `out` terminal: input only (default).
 * - `latch` (two cross-coupled NOR or NAND gates, drawn with the X): inputs "a" (top gate) and "b" (bottom gate),
 *   outputs "Q" (top) and "Qn" (bottom).
 * - `ff` (a flip-flop or latch block): inputs by letter ("D", "T", "J", "K", "S", "R") and "C" (the clock or
 *   enable), outputs "Q" and "Qn". `clock`: 'rise' (triangle), 'fall' (triangle and bubble), 'high' (level,
 *   no triangle), 'low' (level, bubble).
 */
export type SchGateKind = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'NOT' | 'BUF'
export type FFSymbol = 'D' | 'T' | 'JK' | 'SR'
export type ClockMark = 'rise' | 'fall' | 'high' | 'low'

export type SchPart =
  | { id: string; kind: SchGateKind; at: [number, number]; inputs?: 1 | 2 | 3 }
  | { id: string; kind: 'in' | 'out'; label: string; at: [number, number] }
  | { id: string; kind: 'latch'; gate: 'NOR' | 'NAND'; at: [number, number] }
  | { id: string; kind: 'ff'; ff: FFSymbol; clock: ClockMark; at: [number, number]; name?: string }

/**
 * A wire from an output pin to an input pin. Optional routing overrides, in grid units: `viaX` the column of
 * the vertical run of a forward wire; `viaY` the row of the horizontal run of a feedback wire.
 */
export interface SchWire { from: string; to: string; viaX?: number; viaY?: number }

export interface Netlist {
  parts: SchPart[]
  wires: SchWire[]
  /** A dashed frame around a part of the drawing (the exams frame the memory element), grid corners inclusive. */
  frame?: { from: [number, number]; to: [number, number] }
}
