import type { Bit, TruthTable } from '../logic/boolean'
import type { Circuit, GateKind } from '../logic/circuit'
import type { WaveKind } from '../logic/waveform'
import type { Netlist } from '../ui/schematic/netlist'

/**
 * A state machine as content writes it, serialisable and checked by the validator. States are integer codes,
 * the first state variable is the MSB; inputs and outputs likewise (inputs[0] / outputs[0] is the MSB).
 * - `rows`: next[s][x] and out[s][x] for every used state code s and input code x.
 * - `equations`: one next-state equation per state variable and one equation per output, typed as text
 *   (e.g. { A: "A'X + B" }); the output names are the keys of `out`, in order. See src/logic/expr.ts.
 * `used`: the state codes in use (the others are unused codes, don't-cares). Default: all 2^stateBits codes.
 * Build the logic-core Fsm with machineOf (src/ui/lab/seqLogic.ts).
 */
export type MachineSpec =
  | { from: 'rows'; stateVars: string[]; inputs: string[]; outputs: string[]; next: number[][]; out: number[][]; used?: number[] }
  | { from: 'equations'; stateVars: string[]; inputs: string[]; next: Record<string, string>; out: Record<string, string>; used?: number[] }

/** Flip-flop types an `fsm-equations` puzzle can ask for (SR is never asked: its forbidden input has no place in a design). */
export type DesignFF = 'D' | 'T' | 'JK'

export type LabPuzzle =
  | { type: 'circuit'; spec: TruthTable; allowed: GateKind[]; optimalGates: number; reference: Circuit; unlocksChip?: { name: string; inputs: string[]; outputs: string[] } }
  | { type: 'kmap'; nVars: 2 | 3 | 4; minterms: number[]; dontCares: number[] }
  | { type: 'number'; prompt: string; answer: string; check: 'exact' | 'numeric'; compute?: () => string }
  | { type: 'delay'; circuit: Circuit; askAt: string; answer: number }
  | { type: 'code'; definition: string; encode: (bits: string) => string; inputs: string[] }
  /**
   * Fill the state table (next state and/or output of every used state and input) of `machine`, shown as its
   * equations (machine.from must be 'equations'), as a state diagram, or not at all ('none': the room intro
   * describes it in words). Checked cell by cell against stateTable.
   * `rows`: only these present states are asked (exam style: "write the rows of 000 and 110"); then only they
   * must be defined (see puzzleTable), and the 16-row cap counts the asked rows.
   */
  | { type: 'state-table'; machine: MachineSpec; show: 'equations' | 'diagram' | 'none'; fill?: 'next' | 'out' | 'both'; rows?: number[] }
  /**
   * Write the flip-flop input equations (D by default; T or J/K) and the output equations of `machine`, whose
   * state encoding is given, shown as a state table or a diagram. Each equation is checked for equivalence with
   * don't-cares free (unused state codes, and for JK the excitation's x); the optimal star needs total literals
   * <= the QM minimum. stateVars + inputs must be 2–4 variables (an embedded K-map helps with each function).
   */
  | { type: 'fsm-equations'; machine: MachineSpec; show: 'table' | 'diagram'; ff?: DesignFF }
  /**
   * Draw Q under the given clock and inputs, one cell per column (a column is a phase or part of one).
   * Must pass validateWaveConfig(kind, clk, inputs, q0). Checked against simulateWave.
   */
  | { type: 'waveform'; kind: WaveKind; clk: Bit[]; inputs: Record<string, Bit[]>; q0: Bit }
  /**
   * Put equivalent states of a completely specified machine in the same group. Checked with samePartition
   * against reduceStates (group order and naming do not matter). The machine must be reducible.
   */
  | { type: 'state-reduce'; machine: MachineSpec; show: 'table' | 'diagram' }
  /** Identify the memory element drawn by `schematic` (2–6 options; a fixed answer). */
  | { type: 'identify'; schematic: Netlist; question: string; options: string[]; correct: number }

export interface Hint { text: string }
export interface Room { id: string; title: string; intro: string; puzzle: LabPuzzle; hints: Hint[] }

export type Card =
  | { id: string; kind: 'claim'; stage: string; text: string; isTrue: boolean; reasons: string[]; correctReason: number; examReason: string; knowledge: string; source: string }
  | { id: string; kind: 'mcq'; stage: string; text: string; options: [string, string, string, string, string, string]; correct: number; knowledge: string; source: string }

export type Claim = Extract<Card, { kind: 'claim' }>
export type Mcq = Extract<Card, { kind: 'mcq' }>

export interface Stage { id: string; order: number; title: string; rooms: Room[]; cards: Card[] }

/** Exam topics (spec 6.5): 1 numbers, IEEE and codes; 2 adders and minimisation; 3 MUX and ROM/PLA; 4 sequential. */
export type ExamTopic = 1 | 2 | 3 | 4

/**
 * One mock-exam question (spec 6.7.1): three parts on one topic, like the institute's exams.
 * - א' (10): `prompt` + the lab puzzle `a`, all or nothing.
 * - ב' (5 + 5): the claim `b` (true/false, then its reason).
 * - ג' (5): the six-option `c`.
 * `b` and `c` use the card format with `stage` set to the boss id. `review` names the lesson and/or room to go
 * back to after a mistake (at least one; the validator checks they exist).
 */
export interface ExamQuestion {
  id: string
  topic: ExamTopic
  prompt: string
  a: LabPuzzle
  b: Claim
  /** Part ג; `figure` draws a schematic above the options (e.g. "which element is drawn?"). */
  c: Mcq & { figure?: Netlist }
  /**
   * Whether part א needs the puzzle's optimum for its 10 points (a minimal cover, minimal literals, the
   * optimal gate count). Default: true for kmap and fsm-equations, false otherwise.
   */
  aNeedsOptimal?: boolean
  review: { lesson?: string; room?: string }
}

/** The world's boss: a mock exam drawn from `bank` (spec 6.5). It opens by the 60% rule on the last stage. */
export interface Boss { id: string; title: string; bank: ExamQuestion[] }

export interface World { id: string; title: string; icon: string; stages: Stage[]; boss?: Boss }
