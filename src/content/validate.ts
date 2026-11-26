import { matches } from '../logic/boolean'
import { arrivalTimes, circuitTruthTable, gateCount, usesOnly, type Chip } from '../logic/circuit'
import type { Card, Room, World } from './types'

const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase()
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function validateRoom(room: Room, chips: Record<string, Chip>, errs: string[]): void {
  const p = room.puzzle
  const err = (m: string) => errs.push(`${room.id}: ${m}`)
  switch (p.type) {
    case 'circuit': {
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
  }
}

function validateCard(card: Card, stageId: string, errs: string[]): void {
  const err = (m: string) => errs.push(`${card.id}: ${m}`)
  if (card.stage !== stageId) err(`stage "${card.stage}" differs from containing stage "${stageId}"`)
  if (!card.source || !card.source.trim()) err('source is empty')
  if (card.kind === 'claim') {
    const words = card.examReason.trim().split(/\s+/).filter(Boolean)
    if (words.length > 15) err(`examReason has ${words.length} words (max 15)`)
    if (card.reasons.length === 0) err('claim has no reasons')
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
  return errs
}
