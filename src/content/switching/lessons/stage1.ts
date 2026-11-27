import type { Figures, Lesson } from '../../lessons/types'
import { fromBase, toBase } from '../../../logic/numbers'
import { ltr } from '../helpers'
import { syl } from '../syllabus'

/**
 * Stage 1 lessons. Task 1 ships ONE sample lesson that exercises the engine (explain, a goal-less widget, check,
 * check-number, a number `try`, recap and a skip quiz). Task 2 replaces it with the real lessons 1.1–1.3.
 */
export const lessons: Lesson[] = [
  {
    id: 'sw-1-l1', stage: 'sw-1-numbers', order: 1,
    title: 'מה זה בסיס? ערך המקום', minutes: 5,
    blurb: 'כל ספרה שווה לפי המקום שלה: מעשרוני לבינארי ובחזרה.',
    source: syl(1),
    steps: [
      {
        id: 'place', kind: 'explain', figure: 's1-place',
        text: `במספר 345 הספרה 3 לא שווה שלוש: היא שווה שלוש מאות, כי היא יושבת במקום של המאות. כל מקום שווה פי 10 מהמקום שמימינו, ולכן ${ltr('345 = 3·100 + 4·10 + 5·1')}.`,
      },
      {
        id: 'dial', kind: 'widget', widget: 'BaseDial', config: { base: 2, digits: 4 },
        prompt: 'שנו את הספרות וראו איך משקל המקום של כל ספרה בונה את הערך.',
      },
      {
        id: 'base-r', kind: 'explain',
        text: `בבסיס r יש r ספרות, מ-0 עד ${ltr('r − 1')}, וכל מקום שווה פי r מהמקום שמימינו. בבסיס 2 יש רק 0 ו-1, ומשקלי המקומות מימין לשמאל הם 1, 2, 4, 8 וכן הלאה.`,
      },
      {
        id: 'weight', kind: 'check',
        prompt: `כמה שווה הספרה 1 במספר ${ltr('(1000)₂')}?`,
        options: ['1', '4', '8', '1000'],
        correct: 2,
        feedback: [
          'זה הערך של הספרה עצמה, אבל היא יושבת במקום הרביעי מימין, והמקום קובע את המשקל.',
          'המשקל 4 שייך למקום השלישי מימין. כאן יש שלושה אפסים מימין ל-1, כלומר המקום הרביעי.',
          `נכון: המקום הרביעי מימין בבסיס 2 שווה ${ltr('2³ = 8')}.`,
          'כך המספר נראה בעשרוני, אבל כאן הבסיס הוא 2 ולא 10, ולכן כל מקום גדל פי 2 בלבד.',
        ],
      },
      {
        id: 'to-dec', kind: 'check-number',
        prompt: `כמה שווה ${ltr('(1011)₂')} בבסיס 10?`,
        answer: '11', compute: () => String(fromBase('1011', 2)),
        feedbackWrong: `סכמו את משקלי המקומות שבהם יש 1: ${ltr('8 + 2 + 1')}.`,
      },
      {
        id: 'to-bin', kind: 'try',
        prompt: 'עכשיו בכיוון ההפוך: פרקו את 13 לחזקות של 2.',
        puzzle: { type: 'number', prompt: 'כתבו את 13 בבסיס 2', answer: '1101', check: 'exact', compute: () => toBase(13, 2) },
        hints: [{ text: `החזקה הגדולה ביותר של 2 שנכנסת ב-13 היא 8, ונשארים 5: ${ltr('13 = 8 + 4 + 1')}.` }],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          'ערך של ספרה הוא הספרה כפול משקל המקום שלה.',
          `בבסיס r המשקלים מימין לשמאל הם ${ltr('1, r, r², r³')} וכן הלאה.`,
          'מבסיס r לעשרוני: מכפילים כל ספרה במשקל שלה וסוכמים.',
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: `כמה שווה ${ltr('(101)₂')} בבסיס 10?`, options: ['3', '5', '101', '6'], correct: 1 },
      { id: 'q2', prompt: 'אילו ספרות מותרות בבסיס 8?', options: ['0 עד 8', '1 עד 8', '0 עד 7', '0 ו-1 בלבד'], correct: 2 },
      { id: 'q3', prompt: 'כמה שווה המקום השלישי מימין בבסיס 5?', options: ['5', '15', '25', '125'], correct: 2 },
      { id: 'q4', prompt: 'מה הייצוג של 6 בבסיס 2?', options: ['110', '101', '011', '111'], correct: 0 },
      { id: 'q5', prompt: `כמה שווה ${ltr('(12)₃')} בבסיס 10?`, options: ['12', '5', '6', '7'], correct: 1 },
      { id: 'q6', prompt: 'פי כמה גדל משקל המקום כשזזים מקום אחד שמאלה בבסיס 16?', options: ['פי 2', 'פי 10', 'פי 16', 'פי 4'], correct: 2 },
    ],
  },
]

/** Inline SVG figures for this stage's explain steps, by id (prefixed "s1-"). Colours come from theme tokens. */
export const figures: Figures = {
  's1-place': `<svg viewBox="0 0 300 96" role="img" aria-label="345: מאות, עשרות, יחידות" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <rect x="30" y="8" width="64" height="52" rx="10" fill="none" stroke="var(--amber)" stroke-width="2"/>
    <rect x="118" y="8" width="64" height="52" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <rect x="206" y="8" width="64" height="52" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <text x="62" y="46" font-size="30" font-weight="700" fill="var(--amber)">3</text>
    <text x="150" y="46" font-size="30" font-weight="700" fill="var(--text)">4</text>
    <text x="238" y="46" font-size="30" font-weight="700" fill="var(--text)">5</text>
    <text x="62" y="84" font-size="14" fill="var(--muted)">×100</text>
    <text x="150" y="84" font-size="14" fill="var(--muted)">×10</text>
    <text x="238" y="84" font-size="14" fill="var(--muted)">×1</text>
  </g>
</svg>`,
}
