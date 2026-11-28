import type { Card } from '../types'
import { cardsFor, ltr } from './helpers'
import { syl } from './syllabus'

const { claim } = cardsFor('sw-6-latches')

/** Stage 6 cards (Task 3 adds the rest). */
export const stage6Cards: Card[] = [
  claim('sw-6-c1', {
    text: `בדלגלג JK, כאשר ${ltr('J = K = 1')} בקצה השעון, היציאה Q נשארת בלי שינוי.`,
    isTrue: false,
    reasons: [
      `בקצה השעון עם ${ltr('J = K = 1')} היציאה מתהפכת לערך ההפוך שלה`,
      `הצירוף ${ltr('J = K = 1')} אסור, בדיוק כמו ${ltr('S = R = 1')} בדלגלג SR`,
      `הצירוף ${ltr('J = K = 1')} מאפס את הדלגלג בכל קצה`,
    ],
    correctReason: 0,
    examReason: 'כש-J ו-K שניהם 1 הדלגלג מתהפך בכל קצה שעון',
    knowledge: `ב-JK הצירוף ${ltr('J = K = 1')} הוא מצב היפוך: בכל קצה פעיל Q מתחלף. זה ההבדל העיקרי מדלגלג SR.`,
    source: syl(9),
  }),
]
