import type { Circuit, Node, Wire } from '../../logic/circuit'
import type { Stage } from '../types'

const n = (id: string, kind: Node['kind'], label?: string): Node => ({ id, kind, label, x: 0, y: 0 })
const w = (from: string, to: string, pin = 0): Wire => ({ from: { node: from, pin: 0 }, to: { node: to, pin } })

/** Half adder from 5 NAND gates: S = A xor B, C = A and B. */
const halfAdderNand: Circuit = {
  nodes: [
    n('A', 'IN', 'A'), n('B', 'IN', 'B'),
    n('n1', 'NAND'), n('n2', 'NAND'), n('n3', 'NAND'), n('n4', 'NAND'), n('n5', 'NAND'),
    n('C', 'OUT', 'C'), n('S', 'OUT', 'S'),
  ],
  wires: [
    w('A', 'n1', 0), w('B', 'n1', 1),
    w('A', 'n2', 0), w('n1', 'n2', 1),
    w('B', 'n3', 0), w('n1', 'n3', 1),
    w('n2', 'n4', 0), w('n3', 'n4', 1),
    w('n1', 'n5', 0), w('n1', 'n5', 1),
    w('n5', 'C'), w('n4', 'S'),
  ],
}

export const stage3: Stage = {
  id: 'sw-3-boolean', order: 3, title: 'אלגברה בוליאנית ושערים',
  rooms: [{
    id: 'sw-3-r1', title: 'מחבר למחצה מ-NAND',
    intro: 'בנו מחבר למחצה (Half Adder) באמצעות שערי NAND בלבד. כניסות A,B; יציאות C (נשא) ו-S (סכום).',
    puzzle: {
      type: 'circuit',
      spec: { inputs: ['A', 'B'], outputs: ['C', 'S'], rows: [[0, 0], [0, 1], [0, 1], [1, 0]] },
      allowed: ['NAND'], optimalGates: 5, reference: halfAdderNand,
      unlocksChip: { name: 'HA', inputs: ['A', 'B'], outputs: ['C', 'S'] },
    },
    hints: [{ text: 'הסכום הוא XOR והנשא הוא AND; את שניהם אפשר לבנות מ-NAND, ושער NAND משותף חוסך שערים.' }],
  }],
  cards: [{
    id: 'sw-3-c1', kind: 'claim', stage: 'sw-3-boolean',
    text: 'שער NAND לבדו מספיק כדי לממש כל פונקציה בוליאנית.',
    isTrue: true,
    reasons: ['אפשר לממש באמצעותו NOT ו-AND, וקבוצה זו שלמה', 'כי NAND הוא שער דו-כניסתי'],
    correctReason: 0,
    examReason: 'NAND נותן NOT ו-AND, ואלה מספיקים לכל פונקציה.',
    knowledge: 'NAND ו-NOR הם שערים אוניברסליים: כל פונקציה בוליאנית ניתנת למימוש בהם בלבד.',
    source: 'מנו, פרק 3',
  }],
}
