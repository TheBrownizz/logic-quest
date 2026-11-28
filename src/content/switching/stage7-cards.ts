import type { Card } from '../types'
import { cardsFor } from './helpers'
import { syl } from './syllabus'

const { claim } = cardsFor('sw-7-fsm')

/** Stage 7 cards (Task 4 adds the rest). */
export const stage7Cards: Card[] = [
  claim('sw-7-c1', {
    text: 'במכונת Moore היציאה תלויה רק במצב הנוכחי, ולא בכניסה באותו רגע.',
    isTrue: true,
    reasons: [
      'במכונת Moore לכל מצב יש ערך יציאה אחד, וכותבים אותו בתוך עיגול המצב',
      'במכונת Moore היציאה נכתבת על החצים, יחד עם הכניסה',
      'למכונת Moore אין כניסות בכלל, ולכן היציאה קבועה',
    ],
    correctReason: 0,
    examReason: 'ב-Moore היציאה היא פונקציה של המצב בלבד',
    knowledge: 'Moore: היציאה נקבעת מהמצב בלבד ונכתבת בעיגול. Mealy: היציאה תלויה גם בכניסה ונכתבת על החץ.',
    source: syl(9),
  }),
]
