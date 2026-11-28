import { matches } from '../logic/boolean'
import { arrivalTimes, circuitTruthTable, gateCount, usesOnly, type Chip } from '../logic/circuit'
import type { Circuit } from '../logic/circuit'
import { validateWaveConfig } from '../logic/waveform'
import { reduceStates, type StateTable } from '../logic/fsm'
import { layoutSchematic } from '../ui/schematic/geometry'
import { layoutStateDiagram } from '../ui/schematic/stateDiagram'
import { tableOf, usedRows, usedStates } from '../ui/lab/seqLogic'
import { allLessons } from './lessons/catalog'
import type { Card, ExamQuestion, MachineSpec, Room, World } from './types'

const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase()
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** The editor's gates take exactly 2 inputs (NOT takes 1); chips are not limited. */
function checkFanIn(c: Circuit, err: (m: string) => void): void {
  const count = new Map<string, number>()
  for (const x of c.wires) count.set(x.to.node, (count.get(x.to.node) ?? 0) + 1)
  for (const nd of c.nodes) {
    if (typeof nd.kind === 'object' || nd.kind === 'IN' || nd.kind === 'OUT') continue
    const k = count.get(nd.id) ?? 0
    const max = nd.kind === 'NOT' ? 1 : 2
    if (k > max) err(`gate ${nd.id} (${nd.kind}) has ${k} inputs; the editor allows ${max}`)
  }
}

/** Validates one room's puzzle against the chips available to it; problems are pushed to `errs` as "<room id>: ...". */
export function validateRoom(room: Room, chips: Record<string, Chip>, errs: string[]): void {
  const p = room.puzzle
  const err = (m: string) => errs.push(`${room.id}: ${m}`)
  switch (p.type) {
    case 'circuit': {
      checkFanIn(p.reference, err)
      try {
        const tt = circuitTruthTable(p.reference, chips)
        if ('error' in tt) {
          err(`reference circuit invalid (${tt.error.kind} at ${tt.error.nodeId})`)
          break
        }
        if (!sameList(tt.inputs, p.spec.inputs) || !sameList(tt.outputs, p.spec.outputs)) {
          err(`spec inputs/outputs [${p.spec.inputs}]->[${p.spec.outputs}] differ from reference [${tt.inputs}]->[${tt.outputs}]`)
        } else if (tt.rows.length !== p.spec.rows.length || !matches(p.spec, tt).ok) {
          err('reference does not match spec truth table')
        }
        if (!usesOnly(p.reference, p.allowed, chips)) err(`reference uses gates outside allowed [${p.allowed}]`)
        const gc = gateCount(p.reference, chips)
        if (gc > p.optimalGates) err(`reference uses ${gc} gates, more than optimalGates ${p.optimalGates}`)
      } catch (e) {
        err(`reference circuit cannot be analysed: ${msg(e)}`)
      }
      break
    }
    case 'kmap': {
      const size = 1 << p.nVars
      const bad = [...p.minterms, ...p.dontCares].filter(m => !Number.isInteger(m) || m < 0 || m >= size)
      if (bad.length) err(`k-map cells out of range [0,${size}): ${bad.join(',')}`)
      if (p.minterms.length === 0) err('k-map has no 1-cells')
      const dc = new Set(p.dontCares)
      const both = p.minterms.filter(m => dc.has(m))
      if (both.length) err(`k-map minterms and dontCares overlap: ${both.join(',')}`)
      break
    }
    case 'number': {
      if (p.compute) {
        let got: string
        try { got = p.compute() } catch (e) { err(`compute() threw: ${msg(e)}`); break }
        if (norm(got) !== norm(p.answer)) err(`compute() gives "${got}" but answer is "${p.answer}"`)
      }
      break
    }
    case 'delay': {
      checkFanIn(p.circuit, err)
      try {
        const at = arrivalTimes(p.circuit, chips)
        if (!(p.askAt in at)) err(`askAt node "${p.askAt}" does not exist`)
        else if (at[p.askAt] !== p.answer) err(`arrival time at ${p.askAt} is ${at[p.askAt]}, answer says ${p.answer}`)
      } catch (e) {
        err(`delay circuit cannot be analysed: ${msg(e)}`)
      }
      break
    }
    case 'code': {
      if (p.inputs.length === 0) err('code room needs a non-empty inputs list')
      break
    }
    case 'state-table': {
      const t = machineTable(p.machine, err)
      if (!t) break
      if (p.show === 'equations' && p.machine.from !== 'equations') err('show "equations" needs a machine given by equations')
      if (p.show === 'diagram') drawable(t, err)
      if (usedRows(t).length > 16) err(`state table has ${usedRows(t).length} rows (at most 16)`)
      if (p.fill === 'out' && t.outputs.length === 0) err('fill "out" but the machine has no outputs')
      break
    }
    case 'fsm-equations': {
      const t = machineTable(p.machine, err)
      if (!t) break
      const n = t.stateVars.length + t.inputs.length
      if (n < 2 || n > 4) err(`fsm-equations needs 2–4 variables (state variables + inputs) for its K-maps, has ${n}`)
      if (p.show === 'diagram') drawable(t, err)
      break
    }
    case 'waveform': {
      for (const m of validateWaveConfig(p.kind, p.clk, p.inputs, p.q0)) err(`waveform: ${m}`)
      if (p.clk.length < 4 || p.clk.length > 24) err(`waveform has ${p.clk.length} columns (4–24)`)
      const extra = Object.keys(p.inputs).filter(k => !WAVE_INPUTS[p.kind]?.includes(k))
      if (extra.length) err(`waveform inputs ${extra.join(',')} are not inputs of ${p.kind}`)
      break
    }
    case 'state-reduce': {
      const t = machineTable(p.machine, err)
      if (!t) break
      const states = usedStates(t)
      if (states.length > 8) err(`state-reduce has ${states.length} states (at most 8)`)
      try {
        if (reduceStates(t).length === states.length) err('state-reduce: nothing to merge (every state is distinct)')
      } catch (e) { err(`state-reduce: ${msg(e)}`) }
      if (p.show === 'diagram') drawable(t, err)
      break
    }
    case 'identify': {
      if (!p.question.trim()) err('identify question is empty')
      if (p.options.length < 2 || p.options.length > 6) err(`identify has ${p.options.length} options (need 2–6)`)
      if (new Set(p.options.map(o => o.trim())).size !== p.options.length || p.options.some(o => !o.trim())) err('identify options are not distinct and non-empty')
      if (!Number.isInteger(p.correct) || p.correct < 0 || p.correct >= p.options.length) err('identify correct out of range')
      try { layoutSchematic(p.schematic) } catch (e) { err(`schematic: ${msg(e)}`) }
      break
    }
  }
}

const WAVE_INPUTS: Record<string, string[]> = { 'latch-D': ['D'], 'latch-SR': ['S', 'R'], 'ff-D': ['D'], 'ff-T': ['T'], 'ff-JK': ['J', 'K'] }

/** The machine's state table, or undefined after reporting why it cannot be built. */
function machineTable(m: MachineSpec, err: (m: string) => void): StateTable | undefined {
  // Review Focus 1: a machine driven by S and R would list the forbidden S=R=1 input in its table
  if (m.inputs.includes('S') && m.inputs.includes('R')) {
    err('machine has inputs S and R: its table would list the forbidden S=R=1 input')
    return undefined
  }
  if (m.stateVars.length < 1 || m.stateVars.length > 3) err(`machine has ${m.stateVars.length} state variables (1–3)`)
  if (m.inputs.length > 2) err(`machine has ${m.inputs.length} inputs (at most 2)`)
  try { return tableOf(m) } catch (e) { err(`machine: ${msg(e)}`); return undefined }
}

function drawable(t: StateTable, err: (m: string) => void): void {
  try { layoutStateDiagram(t) } catch (e) { err(`state diagram: ${msg(e)}`) }
}

/** One boss question: part א as a room, parts ב and ג as cards of the boss, and a review link that exists. */
function validateExamQuestion(q: ExamQuestion, w: World, bossId: string, chips: Record<string, Chip>, lessonIds: Set<string>, errs: string[]): void {
  const err = (m: string) => errs.push(`${q.id}: ${m}`)
  if (![1, 2, 3, 4].includes(q.topic)) err(`topic ${q.topic} is not 1–4`)
  if (!q.prompt.trim()) err('prompt is empty')
  validateRoom({ id: q.id, title: q.id, intro: q.prompt, puzzle: q.a, hints: [] }, chips, errs)
  if (q.b.kind !== 'claim') err('part b must be a claim')
  if (q.c.kind !== 'mcq') err('part c must be an mcq')
  validateCard(q.b, bossId, errs)
  validateCard(q.c, bossId, errs)
  const roomIds = new Set(w.stages.flatMap(s => s.rooms.map(r => r.id)))
  if (!q.review.lesson && !q.review.room) err('review needs a lesson or a room')
  if (q.review.room && !roomIds.has(q.review.room)) err(`review room "${q.review.room}" does not exist`)
  if (q.review.lesson && !lessonIds.has(q.review.lesson)) err(`review lesson "${q.review.lesson}" does not exist`)
}

function validateCard(card: Card, stageId: string, errs: string[]): void {
  const err = (m: string) => errs.push(`${card.id}: ${m}`)
  if (card.stage !== stageId) err(`stage "${card.stage}" differs from containing stage "${stageId}"`)
  if (!card.source || !card.source.trim()) err('source is empty')
  if (card.kind === 'claim') {
    const words = card.examReason.trim().split(/\s+/).filter(Boolean)
    if (words.length > 15) err(`examReason has ${words.length} words (max 15)`)
    if (card.reasons.length < 2) err(`claim has ${card.reasons.length} reasons (need at least 2)`)
    if (new Set(card.reasons.map(r => r.trim())).size !== card.reasons.length) err('claim reasons are not distinct')
    if (!Number.isInteger(card.correctReason) || card.correctReason < 0 || card.correctReason >= card.reasons.length) {
      err('correctReason out of range')
    }
  } else {
    if (card.options.length !== 6) err(`mcq has ${card.options.length} options (need 6)`)
    if (new Set(card.options).size !== card.options.length) err('mcq options are not distinct')
    if (!Number.isInteger(card.correct) || card.correct < 0 || card.correct >= card.options.length) err('correct out of range')
  }
}

export function validateWorld(w: World, chips: Record<string, Chip> = {}): string[] {
  const errs: string[] = []
  const all: Record<string, Chip> = { ...chips }
  for (const [key, chip] of Object.entries(chips)) {
    if (key !== chip.name) errs.push(`chips: key "${key}" differs from chip.name "${chip.name}"`)
  }

  const seen = new Set<string>()
  const dup = (id: string) => {
    if (seen.has(id)) errs.push(`${id}: duplicate id`)
    seen.add(id)
  }
  dup(w.id)

  for (const stage of [...w.stages].sort((a, b) => a.order - b.order)) {
    dup(stage.id)
    for (const room of stage.rooms) {
      dup(room.id)
      // Validate against only the chips available so far (passed in + earlier rooms).
      validateRoom(room, all, errs)
      const p = room.puzzle
      if (p.type === 'circuit' && p.unlocksChip) {
        const u = p.unlocksChip
        if (all[u.name]) errs.push(`${room.id}: chip "${u.name}" is already unlocked (duplicate unlock)`)
        else all[u.name] = { name: u.name, inputs: u.inputs, outputs: u.outputs, circuit: p.reference }
        if (!sameList(u.inputs, p.spec.inputs) || !sameList(u.outputs, p.spec.outputs)) {
          errs.push(`${room.id}: unlocksChip inputs/outputs differ from spec`)
        }
      }
    }
    for (const card of stage.cards) {
      dup(card.id)
      validateCard(card, stage.id, errs)
    }
  }
  if (w.boss) {
    dup(w.boss.id)
    if (w.stages.some(s => s.id === w.boss!.id)) errs.push(`${w.boss.id}: the boss id is also a stage id`)
    const lessonIds = new Set(allLessons.map(l => l.id))
    for (const q of w.boss.bank) {
      dup(q.id)
      dup(q.b.id)
      dup(q.c.id)
      validateExamQuestion(q, w, w.boss.id, all, lessonIds, errs)
    }
  }
  return errs
}
