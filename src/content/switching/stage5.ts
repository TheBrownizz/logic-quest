import type { Node, Wire } from '../../logic/circuit'
import type { Stage } from '../types'

const n = (id: string, kind: Node['kind'], label?: string, delay?: number): Node => ({ id, kind, label, x: 0, y: 0, delay })
const w = (from: string, to: string, pin = 0): Wire => ({ from: { node: from, pin: 0 }, to: { node: to, pin } })

export const stage5: Stage = {
  id: 'sw-5-blocks', order: 5, title: 'אבני בניין צירופיות',
  rooms: [{
    id: 'sw-5-r1', title: 'השהיה במסלול הקריטי',
    intro: 'בשער NAND השהיה של 2 יחידות ובשער NOT השהיה של 1. מהו זמן ההגעה הגרוע ביותר ביציאה F?',
    puzzle: {
      type: 'delay',
      circuit: {
        nodes: [n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('g1', 'NAND', undefined, 2), n('g2', 'NOT', undefined, 1), n('F', 'OUT', 'F')],
        wires: [w('A', 'g1', 0), w('B', 'g1', 1), w('g1', 'g2'), w('g2', 'F')],
      },
      askAt: 'F', answer: 3,
    },
    hints: [{ text: 'סכמו את ההשהיות לאורך המסלול הארוך ביותר מכניסה ליציאה.' }],
  }],
  cards: [{
    id: 'sw-5-c1', kind: 'mcq', stage: 'sw-5-blocks',
    text: 'כמה יציאות יש למפענח (Decoder) עם 3 כניסות?',
    options: ['2', '3', '4', '6', '8', '16'],
    correct: 4,
    knowledge: 'מפענח n-ל-2^n מפעיל בדיוק יציאה אחת מבין 2^n; עבור n=3 יש 8 יציאות.',
    source: 'מנו, פרק 5',
  }],
}
