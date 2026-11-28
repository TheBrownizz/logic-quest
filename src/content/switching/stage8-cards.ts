import type { Card } from '../types'
import { cardsFor } from './helpers'
import { syl } from './syllabus'

const { claim } = cardsFor('sw-8-design')

/** Stage 8 cards (Task 5 adds the rest). */
export const stage8Cards: Card[] = [
  claim('sw-8-c1', {
    text: 'צמצום מצבים יכול להקטין את מספר הדלגלגים שהמימוש צריך.',
    isTrue: true,
    reasons: [
      'מספר הדלגלגים תלוי במספר המצבים: אחרי מיזוג ייתכן שמספיקים פחות ביטים לקידוד',
      'צמצום מצבים משנה רק את משוואות היציאה, ולא את המצבים עצמם',
      'מספר הדלגלגים תלוי רק במספר הכניסות של המכונה',
    ],
    correctReason: 0,
    examReason: 'פחות מצבים יכולים להסתפק בפחות ביטי קידוד, כלומר בפחות דלגלגים',
    knowledge: 'n מצבים דורשים לפחות log2 של n ביטים, מעוגל למעלה. מכונה של 5 מצבים שמצטמצמת ל-4 יורדת מ-3 דלגלגים ל-2.',
    source: syl(10),
  }),
]
