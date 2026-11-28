import type { Room } from '../types'

/**
 * Stage 7 rooms (Task 4 adds the rest). The first is a sample that tests/e2e/seq.spec.ts solves: keep its
 * id, puzzle and place (add new rooms after it).
 */
export const stage7Rooms: Room[] = [
  {
    id: 'sw-7-r1', title: 'ממשוואות לטבלה',
    intro: 'למכונה שני משתני מצב, A ו-B, כניסה X ויציאה Y. מלאו את המצב הבא ואת היציאה בכל שורה, לפי המשוואות.',
    puzzle: {
      type: 'state-table', show: 'equations',
      machine: { from: 'equations', stateVars: ['A', 'B'], inputs: ['X'], next: { A: "B'X + AB", B: "A'X + BX'" }, out: { Y: 'AX' } },
    },
    hints: [
      { text: 'בכל שורה הציבו את ערכי A, B ו-X של השורה בכל משוואה.' },
      { text: 'A הוא ה-MSB של המצב, ו-X משתנה בין שתי השורות של אותו מצב.' },
    ],
  },
]
