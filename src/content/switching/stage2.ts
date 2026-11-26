import type { Stage } from '../types'
import { complementR } from '../../logic/numbers'

export const stage2: Stage = {
  id: 'sw-2-arith', order: 2, title: 'אריתמטיקה, IEEE וקודים',
  rooms: [{
    id: 'sw-2-r1', title: 'משלים ל-2',
    intro: 'מצאו את המשלים ל-2 של 00101101 ברוחב 8 ביטים.',
    puzzle: { type: 'number', prompt: 'כתבו את המשלים ל-2 של 00101101 (8 ביטים)', answer: '11010011', check: 'exact', compute: () => complementR('00101101', 2) },
    hints: [{ text: 'הפכו כל ביט והוסיפו 1.' }],
  }],
  cards: [{
    id: 'sw-2-c1', kind: 'mcq', stage: 'sw-2-arith',
    text: 'מהו טווח המספרים בייצוג משלים ל-2 ב-8 ביטים?',
    options: ['0 עד 255', '-127 עד 127', '-128 עד 127', '-128 עד 128', '-255 עד 255', '-256 עד 255'],
    correct: 2,
    knowledge: 'במשלים ל-2 ב-n ביטים הטווח הוא מ- -2^(n-1) עד 2^(n-1) - 1.',
    source: 'מנו, פרק 2',
  }],
}
