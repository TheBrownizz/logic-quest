import type { ExamQuestion } from '../types'
import { complementR, complementR1, digitsValue, findBases } from '../../logic/numbers'
import { muxTree, romBits } from '../../logic/sizing'
import { cardsFor, ltr } from './helpers'
import { syl } from './syllabus'

const BOSS = 'sw-boss'
const { claim, mcq } = cardsFor(BOSS)

/** Carry-in to carry-out delay of one full adder in the topic-2 question (ns). */
const FA_CARRY_NS = 20

/**
 * The mock-exam bank: questions by topic (spec 6.7.1). Task 6 adds 12 more (at least 4 per topic in total).
 * Every answer is computed by src/logic. Ids: sw-boss-q<n>; part ids sw-boss-q<n>-b / -c.
 */
export const bossBank: ExamQuestion[] = [
  {
    id: 'sw-boss-q1', topic: 1,
    prompt: `כל המספרים במשוואה כתובים באותו בסיס לא ידוע r: ${ltr('(3)_r · (5)_r = (21)_r')}. מצאו את r.`,
    a: {
      type: 'number', prompt: 'מהו הבסיס r?', answer: '7', check: 'numeric',
      compute: () => findBases(r => digitsValue('3', r) * digitsValue('5', r), r => digitsValue('21', r), 6).join(','),
    },
    b: claim('sw-boss-q1-b', {
      text: 'בתקן IEEE-754 בדיוק יחיד, מילה שכל ביטי המעריך והמנטיסה שלה אפסים מייצגת את המספר 0.',
      isTrue: true,
      reasons: [
        'מעריך מוטה 0 יחד עם מנטיסה 0 שמורים לייצוג האפס, בשני ערכי ביט הסימן',
        'מעריך מוטה 0 פירושו חזקה 0, ולכן המילה מייצגת את המספר 1',
        'את האפס מייצגים רק כשכל 32 הביטים שווים 1',
      ],
      correctReason: 0,
      examReason: 'מעריך ומנטיסה אפסים שמורים לאפס, עם כל אחד מערכי ביט הסימן',
      knowledge: 'ב-IEEE-754 מעריך מוטה 0 עם מנטיסה 0 הוא אפס; מעריך 0 עם מנטיסה שאינה 0 הוא מספר תת-נורמלי.',
      source: syl(2),
    }),
    c: mcq('sw-boss-q1-c', {
      text: `מהו הייצוג של ${ltr('−5')} בשיטת המשלים ל-2, ברוחב 8 ביטים?`,
      options: [complementR('00000101', 2), complementR1('00000101', 2), '10000101', '00000101', '11111101', '01111011'],
      correct: 0,
      knowledge: 'משלים ל-2: הופכים כל ביט ומוסיפים 1. משלים ל-1 רק הופך, וגודל וסימן רק מדליק את ביט הסימן.',
      source: syl(2),
    }),
    review: { room: 'sw-1-r5', lesson: 'sw-1-l1' },
  },
  {
    id: 'sw-boss-q2', topic: 2,
    prompt: 'מצאו כיסוי מינימלי במפת קרנו. התאים המסומנים X הם Don\'t Care.',
    a: { type: 'kmap', nVars: 4, minterms: [1, 3, 5, 7, 9], dontCares: [11, 15] },
    b: claim('sw-boss-q2-b', {
      text: 'בשיטת הטבלה, כל Prime Implicant שמצאנו חייב להופיע בכיסוי המינימלי.',
      isTrue: false,
      reasons: [
        'רק Prime Implicants חיוניים חייבים להופיע, ואת השאר בוחרים רק כשצריך אותם לכיסוי',
        'כל Prime Implicant מכסה מינטרם שאף Prime Implicant אחר לא מכסה',
        'בשיטת הטבלה אין שלב של בחירת כיסוי, ולכן כולם נכנסים לביטוי',
      ],
      correctReason: 0,
      examReason: 'רק החיוניים חייבים להופיע; את השאר בוחרים לפי הצורך',
      knowledge: 'אחרי מציאת כל ה-Prime Implicants בוחרים קודם את החיוניים, ואז מינימום של נוספים שמשלימים את הכיסוי.',
      source: syl(5),
    }),
    c: mcq('sw-boss-q2-c', {
      text: 'במחבר ripple-carry של 4 ביטים, ההשהיה מכניסת הנשא ליציאת הנשא בכל מחבר מלא היא 20 ns. מה ההשהיה הגרועה ביותר מ-C0 עד C4?',
      options: [`${4 * FA_CARRY_NS} ns`, `${FA_CARRY_NS} ns`, `${2 * FA_CARRY_NS} ns`, `${3 * FA_CARRY_NS} ns`, `${5 * FA_CARRY_NS} ns`, `${8 * FA_CARRY_NS} ns`],
      correct: 0,
      knowledge: 'בשרשרת ripple-carry הנשא עובר דרך כל המחברים המלאים אחד אחרי השני, ולכן ההשהיות מצטברות.',
      source: syl(4),
    }),
    review: { room: 'sw-4-r5', lesson: 'sw-4-l3' },
  },
  {
    id: 'sw-boss-q3', topic: 3,
    prompt: 'רכיב צירופי עם 5 כניסות ו-3 יציאות ממומש בזיכרון ROM שלם. כמה ביטים יש בזיכרון?',
    a: { type: 'number', prompt: 'מספר הביטים ב-ROM', answer: '96', check: 'numeric', compute: () => String(romBits(5, 3)) },
    b: claim('sw-boss-q3-b', {
      text: `מרבב עם 3 קווי בחירה יכול לממש כל פונקציה של 4 משתנים, אם מותר לחבר לכניסות הנתונים 0, 1, X או ${ltr("X'")}.`,
      isTrue: true,
      reasons: [
        `שלושה משתנים בוחרים כניסה, ובכל כניסה הפונקציה של המשתנה הרביעי היא 0, 1, X או ${ltr("X'")}`,
        'מרבב עם 3 קווי בחירה מממש רק פונקציות של 3 משתנים',
        'כדי לממש 4 משתנים צריך להוסיף שער OR לכל כניסת נתונים',
      ],
      correctReason: 0,
      examReason: 'כל כניסת נתונים מקבלת את הפונקציה של המשתנה הרביעי',
      knowledge: `מרבב עם n קווי בחירה מממש כל פונקציה של ${ltr('n + 1')} משתנים כשכניסות הנתונים מקבלות 0, 1, X או ${ltr("X'")}.`,
      source: syl(4),
    }),
    c: mcq('sw-boss-q3-c', {
      text: `כמה מרבבי ${ltr('4×1')} צריך כדי לבנות מרבב ${ltr('16×1')}?`,
      options: [String(muxTree(16, 4).total), '4', '6', '8', '3', '16'],
      correct: 0,
      knowledge: 'ברמה הראשונה 4 מרבבים בוחרים מתוך 16 כניסות, ומרבב אחד נוסף בוחר בין 4 היציאות שלהם.',
      source: syl(4),
    }),
    review: { room: 'sw-5-r4', lesson: 'sw-5-l2' },
  },
  {
    id: 'sw-boss-q4', topic: 4,
    prompt: 'הדיאגרמה מתארת מכונת Mealy שמזהה את הרצף 101 בכניסה X (עם חפיפה). מלאו את טבלת המצבים: מצב הבא ויציאה לכל מצב וכניסה.',
    a: {
      type: 'state-table', show: 'diagram',
      machine: { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Z'], used: [0, 1, 2], next: [[0, 1], [2, 1], [0, 1]], out: [[0, 0], [0, 0], [0, 1]] },
    },
    b: claim('sw-boss-q4-b', {
      text: 'מכונה עם 5 מצבים, שאף שניים מהם אינם שקולים, צריכה לפחות 3 דלגלגים.',
      isTrue: true,
      reasons: [
        'שני דלגלגים נותנים רק 4 קודים, ולחמישה מצבים שונים צריך 5 קודים',
        'מספר הדלגלגים תמיד שווה למספר המצבים של המכונה',
        'דלגלג JK יחיד מספיק לכל מכונה, כי הוא יכול להתהפך',
      ],
      correctReason: 0,
      examReason: 'שני ביטים נותנים 4 קודים בלבד, ויש 5 מצבים שונים',
      knowledge: 'k דלגלגים נותנים 2 בחזקת k קודים. כדי לקודד n מצבים שונים צריך שהקודים יספיקו לכולם.',
      source: syl(10),
    }),
    c: mcq('sw-boss-q4-c', {
      text: 'איזה רכיב משנה את היציאה שלו רק ברגע שהשעון עולה מ-0 ל-1?',
      options: ['D Flip-Flop רגיש לקצה עולה', 'D Latch רגיש לרמה גבוהה', 'SR Latch בלי שעון', 'D Flip-Flop רגיש לקצה יורד', 'JK Latch רגיש לרמה', 'T Latch רגיש לרמה נמוכה'],
      correct: 0,
      knowledge: 'Latch רגיש לרמה ושקוף כל זמן שה-Enable פעיל; Flip-Flop מגיב רק לקצה של השעון.',
      source: syl(9),
    }),
    review: { room: 'sw-7-r1' },
  },
]
