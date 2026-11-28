import type { Room } from '../types'
import { ltr } from './helpers'

/**
 * Stage 8 rooms (Task 5 adds the rest). The first two are samples that tests/e2e/seq.spec.ts solves: keep
 * their ids, puzzles and order (add new rooms after them).
 */
export const stage8Rooms: Room[] = [
  {
    id: 'sw-8-r1', title: 'מונה עד 3 עם D',
    intro: `מונה שסופר S0, S1, S2 וחוזר ל-S0 כאשר ${ltr('X = 1')}, ונשאר במקומו כאשר ${ltr('X = 0')}. הקידוד נתון בטבלה, והקוד 11 לא בשימוש. היציאה Z שווה 1 רק במצב S2.`,
    puzzle: {
      type: 'fsm-equations', show: 'table',
      machine: { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Z'], used: [0, 1, 2], next: [[0, 1], [1, 2], [2, 0]], out: [[0, 0], [0, 0], [1, 1]] },
    },
    hints: [
      { text: 'בדלגלג D הכניסה שווה למצב הבא: DA היא עמודת A במצב הבא.' },
      { text: 'השורות של הקוד 11 הן Don\'t Care בכל המפות. נצלו אותן לקבוצות גדולות.' },
    ],
  },
  {
    id: 'sw-8-r2', title: 'מצבים כפולים',
    intro: 'למכונה חמישה מצבים, כניסה X ויציאה Z. חלקו את המצבים לקבוצות של מצבים שקולים.',
    puzzle: {
      type: 'state-reduce', show: 'table',
      machine: { from: 'rows', stateVars: ['A', 'B', 'C'], inputs: ['X'], outputs: ['Z'], used: [0, 1, 2, 3, 4], next: [[1, 2], [3, 4], [0, 1], [1, 2], [0, 3]], out: [[0, 0], [0, 1], [1, 0], [0, 1], [1, 0]] },
    },
    hints: [
      { text: 'התחילו מהיציאות: מצבים עם יציאות שונות לא יכולים להיות שקולים.' },
      { text: 'בתוך כל קבוצה בדקו שהמצבים הבאים נמצאים גם הם באותן קבוצות.' },
    ],
  },
]
