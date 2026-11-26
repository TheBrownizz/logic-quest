import type { Stage } from '../types'
import { toBase } from '../../logic/numbers'

export const stage1: Stage = {
  id: 'sw-1-numbers', order: 1, title: 'מספרים ובסיסים',
  rooms: [{
    id: 'sw-1-r1', title: 'מעבר לבינארי',
    intro: 'המירו את המספר העשרוני 181 לבסיס 2.',
    puzzle: { type: 'number', prompt: 'כתבו את 181 בבסיס 2', answer: '10110101', check: 'exact', compute: () => toBase(181, 2) },
    hints: [{ text: 'חלקו ב-2 שוב ושוב ורשמו את השאריות מהסוף להתחלה.' }],
  }],
  cards: [{
    id: 'sw-1-c1', kind: 'claim', stage: 'sw-1-numbers',
    text: 'עם n ספרות בבסיס r ניתן לייצג r בחזקת n ערכים שונים.',
    isTrue: true,
    reasons: ['לכל אחת מ-n הספרות יש r ערכים אפשריים, והבחירות בלתי תלויות', 'כי הספרה השמאלית ביותר תמיד משמשת כסימן'],
    correctReason: 0,
    examReason: 'כל ספרה נבחרת בנפרד מ-r אפשרויות, ולכן מכפילים n פעמים.',
    knowledge: 'n ספרות בבסיס r נותנות r^n צירופים, מ-0 עד r^n - 1.',
    source: 'סילבוס: ייצוג מספרים ובסיסי ספירה',
  }],
}
