import { describe, it, expect } from 'vitest'
import { arrivalTimes, simulate, type Circuit, type Node, type Wire } from '../../../src/logic/circuit'
import type { Bit } from '../../../src/logic/boolean'
import { referenceChips } from '../../../src/content/chips'
import { node as nd, wire as w } from '../../../src/content/switching/helpers'
import { switchingWorld } from '../../../src/content/switching/world'
import { adderSubtractor } from '../../../src/content/switching/stage5'
import {
  initial, isGoalMet, snapshot, timing, toNumber, values, type RippleTimelineConfig,
} from '../../../src/ui/lessons/widgets/rippleTimelineLogic'

const chips = referenceChips(switchingWorld)
const FA = 100
const XOR = 75

/** A plain n-bit ripple adder from FA chips (each FA 100 ns), the circuit RippleTimeline stands for. */
function plainAdder(bits: number): Circuit {
  const nodes: Node[] = [nd('Cin', 'IN', 'Cin')]
  const wires: Wire[] = []
  for (let i = 0; i < bits; i++) {
    nodes.push(nd(`A${i}`, 'IN', `A${i}`), nd(`B${i}`, 'IN', `B${i}`), nd(`f${i}`, { chip: 'FA' }, undefined, FA), nd(`S${i}`, 'OUT', `S${i}`))
    wires.push(w(`A${i}`, `f${i}`, 0), w(`B${i}`, `f${i}`, 1), w(i === 0 ? 'Cin' : `f${i - 1}`, `f${i}`, 2, 0), w(`f${i}`, `S${i}`, 0, 1))
  }
  nodes.push(nd('Cout', 'OUT', 'Cout'))
  wires.push(w(`f${bits - 1}`, 'Cout', 0, 0))
  return { nodes, wires }
}

const bitStr = (v: number, n: number) => v.toString(2).padStart(n, '0')

describe('RippleTimeline timing equals arrivalTimes of the equivalent circuit', () => {
  it('plain adder, 2 to 8 bits', () => {
    for (let n = 2; n <= 8; n++) {
      const at = arrivalTimes(plainAdder(n), chips)
      const tm = timing({ a: '0'.repeat(n), b: '0'.repeat(n), delays: { fa: FA } })
      for (let i = 0; i < n; i++) expect(tm.stages[i].end, `n=${n} S${i}`).toBe(at[`S${i}`])
      expect(tm.carry[n], `n=${n} Cout`).toBe(at.Cout)
      expect(tm.settle).toBe(at.Cout)
    }
  })
  it('adder/subtractor with V, 2 to 8 bits (FA 100, XOR 75)', () => {
    for (let n = 2; n <= 8; n++) {
      const at = arrivalTimes(adderSubtractor(n), chips)
      const tm = timing({ a: '0'.repeat(n), b: '0'.repeat(n), delays: { fa: FA, xor: XOR }, m: 1, overflow: true })
      for (let i = 0; i < n; i++) expect(tm.stages[i].end, `n=${n} S${i}`).toBe(at[`S${i}`])
      expect(tm.carry[n], `n=${n} C`).toBe(at.C)
      expect(tm.vReady, `n=${n} V`).toBe(at.V)
      expect(tm.settle).toBe(Math.max(...Object.entries(at).filter(([k]) => /^(S\d|C|V)$/.test(k)).map(([, v]) => v)))
    }
  })
  it('matches the exam numbers: 3 bits V = 450, 8 bits V = 950, 4 bits V = 550', () => {
    const t = (n: number) => timing({ a: '0'.repeat(n), b: '0'.repeat(n), delays: { fa: FA, xor: XOR }, m: 0, overflow: true })
    expect(t(3).vReady).toBe(450)
    expect(t(4).vReady).toBe(550)
    expect(t(8).vReady).toBe(950)
  })
  it('the carry into the first stage is ideal; with M the XOR delays every stage start', () => {
    const tm = timing({ a: '0101', b: '0011', delays: { fa: FA, xor: XOR }, m: 1 })
    expect(tm.carry).toEqual([0, 175, 275, 375, 475])
    expect(tm.stages[0].start).toBe(75)
    expect(tm.bars.map(b => b.id)).toEqual(['xor', 'fa0', 'fa1', 'fa2', 'fa3'])
  })
})

describe('RippleTimeline values equal the simulated circuit', () => {
  it('plain adder, every operand pair of 3 bits', () => {
    const n = 3
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      const v = values({ a: bitStr(a, n), b: bitStr(b, n), delays: { fa: FA } })
      const arg: Record<string, Bit> = { Cin: 0 }
      for (let i = 0; i < n; i++) { arg[`A${i}`] = ((a >> i) & 1) as Bit; arg[`B${i}`] = ((b >> i) & 1) as Bit }
      const sim = simulate(plainAdder(n), arg, chips)
      if ('error' in sim) throw new Error('bad circuit')
      for (let i = 0; i < n; i++) expect(v.sum[i], `${a}+${b} S${i}`).toBe(sim.outputs[`S${i}`])
      expect(v.carry[n]).toBe(sim.outputs.Cout)
      expect(toNumber(v.sum) + v.carry[n] * 8).toBe(a + b)
    }
  })
  it('adder/subtractor: S, C and V equal the simulated circuit for M = 0 and 1', () => {
    const n = 4
    for (const m of [0, 1] as const) for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      const v = values({ a: bitStr(a, n), b: bitStr(b, n), delays: { fa: FA, xor: XOR }, m, overflow: true })
      const arg: Record<string, Bit> = { M: m }
      for (let i = 0; i < n; i++) { arg[`A${i}`] = ((a >> i) & 1) as Bit; arg[`B${i}`] = ((b >> i) & 1) as Bit }
      const sim = simulate(adderSubtractor(n), arg, chips)
      if ('error' in sim) throw new Error('bad circuit')
      for (let i = 0; i < n; i++) expect(v.sum[i], `m=${m} ${a},${b} S${i}`).toBe(sim.outputs[`S${i}`])
      expect(v.carry[n], `m=${m} ${a},${b} C`).toBe(sim.outputs.C)
      expect(v.v, `m=${m} ${a},${b} V`).toBe(sim.outputs.V)
    }
  })
  it('subtraction: C = 1 exactly when A ≥ B (no borrow), and the result is A − B mod 16', () => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      const v = values({ a: bitStr(a, 4), b: bitStr(b, 4), delays: { fa: FA, xor: XOR }, m: 1 })
      expect(v.carry[4]).toBe(a >= b ? 1 : 0)
      expect(toNumber(v.sum)).toBe(((a - b) % 16 + 16) % 16)
    }
  })
  it('the lesson operands: 0111 + 0001 = 1000 and 0101 − 0011 = 0010', () => {
    const p = values({ a: '0111', b: '0001', delays: { fa: FA } })
    expect(p.carry).toEqual([0, 1, 1, 1, 0])
    expect(toNumber(p.sum)).toBe(8)
    const s = values({ a: '0101', b: '0011', delays: { fa: FA, xor: XOR }, m: 1, overflow: true })
    expect(toNumber(s.sum)).toBe(2)
    expect(s.carry).toEqual([1, 1, 0, 1, 1])
    expect(s.v).toBe(0)
  })
})

describe('RippleTimeline snapshot and goal', () => {
  const cfg: RippleTimelineConfig = { a: '0111', b: '0001', delays: { fa: FA } }
  it('the carry reaches one stage per 100 ns', () => {
    expect(snapshot(cfg, 0).stages).toEqual(['active', 'waiting', 'waiting', 'waiting'])
    expect(snapshot(cfg, 100).stages).toEqual(['done', 'active', 'waiting', 'waiting'])
    expect(snapshot(cfg, 250).stages).toEqual(['done', 'done', 'active', 'waiting'])
    expect(snapshot(cfg, 399).settled).toBe(false)
    expect(snapshot(cfg, 400).stages).toEqual(['done', 'done', 'done', 'done'])
    expect(snapshot(cfg, 400).settled).toBe(true)
    expect(snapshot(cfg, 150).carryReady).toEqual([true, true, false, false, false])
  })
  it('settled and time goals', () => {
    expect(initial(cfg)).toEqual({ t: 0 })
    expect(isGoalMet({ t: 0 }, { kind: 'settled' }, cfg)).toBe(false)
    expect(isGoalMet({ t: 395 }, { kind: 'settled' }, cfg)).toBe(false)
    expect(isGoalMet({ t: 400 }, { kind: 'settled' }, cfg)).toBe(true)
    expect(isGoalMet({ t: 200 }, { kind: 'time', t: 200 }, cfg)).toBe(true)
    expect(isGoalMet({ t: 195 }, { kind: 'time', t: 200 }, cfg)).toBe(false)
    expect(isGoalMet({ t: NaN }, { kind: 'settled' }, cfg)).toBe(false)
  })
  it('V is part of "settled" when shown', () => {
    const c: RippleTimelineConfig = { a: '0101', b: '0011', delays: { fa: FA, xor: XOR }, m: 1, overflow: true }
    expect(isGoalMet({ t: 475 }, { kind: 'settled' }, c)).toBe(false)
    expect(isGoalMet({ t: 550 }, { kind: 'settled' }, c)).toBe(true)
    expect(snapshot(c, 549).vReady).toBe(false)
    expect(snapshot(c, 550).vReady).toBe(true)
  })
  it('rejects malformed configs', () => {
    expect(() => timing({ a: '01', b: '011', delays: { fa: FA } })).toThrow()
    expect(() => timing({ a: '0a', b: '01', delays: { fa: FA } })).toThrow()
    expect(() => timing({ a: '0', b: '1', delays: { fa: FA } })).toThrow()
    expect(() => timing({ a: '01', b: '01', delays: { fa: 0 } })).toThrow()
  })
})
