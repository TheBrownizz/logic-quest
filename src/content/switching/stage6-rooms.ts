import type { Room } from '../types'
import { ltr } from './helpers'

/**
 * Stage 6 rooms (Task 3 adds the rest). The first two are samples that tests/e2e/seq.spec.ts solves:
 * keep their ids, puzzles and order (add new rooms after them).
 */
export const stage6Rooms: Room[] = [
  {
    id: 'sw-6-r1', title: 'JK בקצה עולה',
    intro: `דלגלג JK רגיש לקצה עולה של השעון, ו-${ltr('Q = 0')} לפני העמודה הראשונה. ציירו את Q בכל עמודה. בין שני קצוות עולים היציאה לא זזה, גם כשהכניסות משתנות.`,
    puzzle: {
      type: 'waveform', kind: 'ff-JK', q0: 0,
      clk: [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0],
      inputs: { J: [1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1], K: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1] },
    },
    hints: [
      { text: 'מצאו את העמודות שבהן השעון עולה מ-0 ל-1. רק שם Q יכול להשתנות.' },
      { text: `בכל קצה עולה קראו את J ו-K שבעמודה שלפניו. ${ltr('J = K = 1')} הופך את Q.` },
    ],
  },
  {
    id: 'sw-6-r2', title: 'מי הרכיב?',
    intro: 'בשרטוט שתי כניסות, D ו-E, שני שערי AND, מהפך, ושני שערי NOR שמחוברים זה לזה במשוב.',
    puzzle: {
      type: 'identify',
      question: 'איזה רכיב זיכרון ממומש בשרטוט?',
      options: ['D Latch רגיש לרמה גבוהה', 'D Flip-Flop רגיש לקצה עולה', 'SR Latch בלי Enable', 'T Latch רגיש לרמה גבוהה', 'JK Flip-Flop רגיש לקצה עולה', 'רכיב Master-Slave'],
      correct: 0,
      schematic: {
        parts: [
          { id: 'D', kind: 'in', label: 'D', at: [0, 0] },
          { id: 'E', kind: 'in', label: 'E', at: [0, 1] },
          { id: 'inv', kind: 'NOT', at: [1, 0] },
          { id: 'g1', kind: 'AND', at: [2, 1 / 6] },
          { id: 'g2', kind: 'AND', at: [2, 11 / 6] },
          { id: 'L', kind: 'latch', gate: 'NOR', at: [3.4, 1] },
          { id: 'Q', kind: 'out', label: 'Q', at: [4.4, 1 / 3] },
          { id: 'Qn', kind: 'out', label: "Q'", at: [4.4, 5 / 3] },
        ],
        wires: [
          { from: 'D', to: 'inv' }, { from: 'inv', to: 'g1.0' }, { from: 'E', to: 'g1.1' }, { from: 'E', to: 'g2.0' }, { from: 'D', to: 'g2.1' },
          { from: 'g1', to: 'L.a' }, { from: 'g2', to: 'L.b' }, { from: 'L.Q', to: 'Q' }, { from: 'L.Qn', to: 'Qn' },
        ],
        frame: { from: [0.75, -0.3], to: [3.95, 2.3] },
      },
    },
    hints: [
      { text: `כש-${ltr('E = 0')} שני שערי ה-AND מוציאים 0, ולכן הנעילה שומרת את ערכה.` },
      { text: `כש-${ltr('E = 1')} שער אחד מקבל את D ושני את ההפך שלו: אין כאן צירוף אסור.` },
    ],
  },
]
