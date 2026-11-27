import type { TruthTable } from '../logic/boolean'
import type { Circuit, GateKind } from '../logic/circuit'

export type LabPuzzle =
  | { type: 'circuit'; spec: TruthTable; allowed: GateKind[]; optimalGates: number; reference: Circuit; unlocksChip?: { name: string; inputs: string[]; outputs: string[] } }
  | { type: 'kmap'; nVars: 2 | 3 | 4; minterms: number[]; dontCares: number[] }
  | { type: 'number'; prompt: string; answer: string; check: 'exact' | 'numeric'; compute?: () => string }
  | { type: 'delay'; circuit: Circuit; askAt: string; answer: number }
  | { type: 'code'; definition: string; encode: (bits: string) => string; inputs: string[] }

export interface Hint { text: string }
export interface Room { id: string; title: string; intro: string; puzzle: LabPuzzle; hints: Hint[] }

export type Card =
  | { id: string; kind: 'claim'; stage: string; text: string; isTrue: boolean; reasons: string[]; correctReason: number; examReason: string; knowledge: string; source: string }
  | { id: string; kind: 'mcq'; stage: string; text: string; options: [string, string, string, string, string, string]; correct: number; knowledge: string; source: string }

export interface Stage { id: string; order: number; title: string; rooms: Room[]; cards: Card[] }
export interface World { id: string; title: string; icon: string; stages: Stage[] }
