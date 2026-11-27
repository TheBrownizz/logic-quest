import type { Figures, Lesson } from '../../lessons/types'
import { complementR, decodeIEEE754, encodeIEEE754, fromBase, toBase } from '../../../logic/numbers'
import { toGray } from '../../../logic/codes'
import { ltr } from '../helpers'
import { widgetStep } from '../../lessons/widgetTypes'
import { syl } from '../syllabus'

/** The 32 bits of a float32 value (lesson content only uses exactly representable normal numbers). */
const f32 = (v: number): string => encodeIEEE754(v).bits

/** 4-bit addition, carry out of the top column dropped. */
const add4 = (a: string, b: string): string => toBase((fromBase(a, 2) + fromBase(b, 2)) % 16, 2).padStart(4, '0')

/**
 * The invented code of lesson 2.3's `try` step, exactly as its definition reads: for b3b2b1b0 (b3 = MSB),
 * q3 = b3 ⊕ b2, q2 = b2 ⊕ b1, q1 = b1 ⊕ b0, q0 = b0. (Each bit is XORed with its RIGHT neighbour: not Gray.)
 */
export function encodeNeighbour(bits: string): string {
  if (!/^[01]{4}$/.test(bits)) throw new Error(`Expected 4 bits, got "${bits}"`)
  const [b3, b2, b1, b0] = [...bits].map(Number)
  return [b3 ^ b2, b2 ^ b1, b1 ^ b0, b0].join('')
}

export const lessons: Lesson[] = [
  // ───────────────────────────── 2.1 ─────────────────────────────
  {
    id: 'sw-2-l1', stage: 'sw-2-arith', order: 1,
    title: 'חיבור בינארי, משלים ל-2 וגלישה', minutes: 9,
    blurb: 'מחברים ביטים, מייצגים מספרים שליליים, ומזהים מתי התוצאה לא נכנסת.',
    source: syl(2),
    steps: [
      {
        id: 'add', kind: 'explain', figure: 's2-add',
        text: `חיבור בינארי עובד כמו חיבור בעמודות בעשרוני, רק שיש שתי ספרות בלבד: ${ltr('0 + 0 = 0')}, ${ltr('0 + 1 = 1')} ו-${ltr('1 + 1 = 10')}. כשיוצא ${ltr('10')} כותבים 0 ומעבירים נשא 1 לעמודה שמשמאל, כמו ב-${ltr('9 + 1')} בעשרוני. לכן בכל עמודה מחברים עד שלושה ביטים: שני המחוברים והנשא.`,
      },
      {
        id: 'add-check', kind: 'check',
        prompt: `מה הסכום ${ltr('(0101)₂ + (0011)₂')}?`,
        options: ['0110', '0111', '1000'],
        correct: 2,
        feedback: [
          `זה חיבור בלי נשאים: כל עמודה חושבה לבד. אבל בעמודה הימנית ${ltr('1 + 1')} נותן 0 ונשא 1, והנשא ממשיך לעמודה הבאה.`,
          `כאן חושב ${ltr('1 + 1 = 1')}, כמו OR. בבינארי ${ltr('1 + 1 = 10')}: כותבים 0 ומעבירים נשא.`,
          `נכון: הנשא מתגלגל דרך שלוש עמודות עד הביט השמאלי, ומתקבל ${ltr('1000')}, כלומר ${ltr('5 + 3 = 8')}.`,
        ],
      },
      {
        id: 'width', kind: 'explain',
        text: `בחומרה לכל מספר יש רוחב קבוע, למשל 4 ביטים. נשא שיוצא מהעמודה השמאלית נזרק, ונשארים רק ארבעת הביטים. במספרים ללא סימן זו גלישה: ${ltr('1100 + 0101')} נותן ${ltr('0001')} ונשא סופי 1, כי ${ltr('12 + 5 = 17')}, ו-4 ביטים מגיעים רק עד 15.`,
      },
      {
        id: 'width-num', kind: 'check-number',
        prompt: `חברו ${ltr('(1101)₂ + (0111)₂')} ברוחב 4 ביטים. כתבו את ארבעת הביטים של התוצאה.`,
        answer: '0100', compute: () => add4('1101', '0111'),
        feedbackWrong: 'חברו עמודה אחר עמודה מימין והעבירו נשאים. בסוף יוצא נשא מהעמודה השמאלית: אותו זורקים, ונשארים ארבעה ביטים.',
      },
      {
        id: 'signed', kind: 'explain', figure: 's2-ring',
        text: `כדי לייצג גם מספרים שליליים נותנים לביט השמאלי משקל שלילי. בארבעה ביטים המשקלים הם ${ltr('−8, 4, 2, 1')}, ולכן ${ltr('1000')} הוא ${ltr('−8')} ו-${ltr('1111')} הוא ${ltr('−1')}. זה ייצוג משלים ל-2: הטווח הוא מ-${ltr('−8')} עד 7, ביט שמאלי 1 פירושו מספר שלילי, ולכל מספר, גם ל-0, יש ייצוג אחד בלבד.`,
      },
      widgetStep({
        id: 'dial', widget: 'BaseDial', config: { base: 2, width: 4, digits: '0101', signed: true },
        prompt: `שנו את הביטים וצפו בערך. שימו לב: הביט השמאלי שווה ${ltr('−8')}, ולכן כשהוא נדלק הערך צונח מתחת לאפס.`,
      }),
      {
        id: 'signed-check', kind: 'check',
        prompt: `מה הערך של ${ltr('1010')} כמספר עם סימן ברוחב 4 ביטים (משלים ל-2)?`,
        options: [ltr('−5'), '10', ltr('−6'), ltr('−2')],
        correct: 2,
        feedback: [
          `הפכתם את הביטים וקיבלתם ${ltr('0101 = 5')}, אבל שכחתם להוסיף 1. ${ltr('0101 + 1 = 0110')}, כלומר הגודל הוא 6.`,
          `כך קוראים את ${ltr('1010')} כמספר ללא סימן. כאן הביט השמאלי שווה ${ltr('−8')} ולא 8.`,
          `נכון: ${ltr('−8 + 2 = −6')}. אפשר גם להפוך ולהוסיף 1: ${ltr('0101 + 1 = 0110')} הוא 6, ולכן ${ltr('1010')} הוא ${ltr('−6')}.`,
          `קראתם את הביט השמאלי כסימן ואת ${ltr('010')} כגודל. זו שיטה אחרת, סימן וגודל, ולא משלים ל-2.`,
        ],
      },
      widgetStep({
        id: 'negate', widget: 'ComplementLab', config: { base: 2, digits: 4, value: '0110', mode: 'complement' },
        prompt: `כך מקבלים מספר נגדי: מתחילים מ-${ltr('0110')} (שהוא 6), הופכים כל ביט ומוסיפים 1. הריצו את השלבים וראו שמתקבל ${ltr('1010')}, הייצוג של ${ltr('−6')}.`,
      }),
      {
        id: 'subtract', kind: 'explain',
        text: `לכן חיסור הופך לחיבור: ${ltr('A − B = A + (−B)')}, כש-${ltr('−B')} הוא המשלים ל-2 של B. מחברים וזורקים את הנשא הסופי. לדוגמה ${ltr('7 − 5')}: המשלים של ${ltr('0101')} הוא ${ltr('1011')}, ו-${ltr('0111 + 1011 = 1 0010')}. בלי הנשא נשאר ${ltr('0010')}, כלומר 2.`,
      },
      {
        id: 'sub-try', kind: 'try',
        prompt: `עכשיו אתם: חשבו ${ltr('0110 − 0011')} ברוחב 4 ביטים, בשיטת המשלים ל-2.`,
        puzzle: {
          type: 'number', prompt: `כתבו את ${ltr('0110 − 0011')} ב-4 ביטים`, answer: '0011', check: 'exact',
          compute: () => add4('0110', complementR('0011', 2)),
        },
        hints: [
          { text: `הפכו את הביטים של ${ltr('0011')} והוסיפו 1: מתקבל ${ltr('1101')}.` },
          { text: `חברו ${ltr('0110 + 1101 = 1 0011')} וזרקו את הנשא הסופי.` },
        ],
      },
      {
        id: 'overflow', kind: 'explain',
        text: `גם עם סימן התוצאה יכולה לא להיכנס: ${ltr('0101 + 0100')} (5 ועוד 4) נותן ${ltr('1001')}, שהוא ${ltr('−7')}. שני חיוביים נתנו שלילי: זו גלישה. כלל הזיהוי: יש גלישה בדיוק כשהנשא שנכנס לביט הסימן שונה מהנשא שיוצא ממנו. חיבור של חיובי ושלילי אף פעם לא גולש.`,
      },
      {
        id: 'overflow-check', kind: 'check',
        prompt: `מחברים ${ltr('(0110)₂ + (0101)₂')} ברוחב 4 ביטים, כמספרים עם סימן. מה נכון?`,
        options: [
          `התוצאה ${ltr('1011')}, כלומר 11, והחישוב תקין`,
          `התוצאה ${ltr('1011')}, כלומר ${ltr('−5')}: שני חיוביים נתנו שלילי, ולכן יש גלישה`,
          'אין גלישה, כי לא יצא נשא מהעמודה השמאלית',
        ],
        correct: 1,
        feedback: [
          `עם סימן ${ltr('1011')} הוא ${ltr('−8 + 3 = −5')}, לא 11. המספר 11 בכלל מחוץ לטווח, שנגמר ב-7.`,
          `נכון: ${ltr('6 + 5 = 11')} לא נכנס בטווח ${ltr('−8…7')}, והתוצאה "עטפה" ל-${ltr('−5')}.`,
          'נשא סופי מעיד על גלישה רק במספרים ללא סימן. כאן נכנס לביט הסימן נשא 1 ויצא ממנו 0, וההבדל הזה הוא הגלישה.',
        ],
      },
      widgetStep({
        id: 'float-sign', widget: 'BitField',
        config: { bits: f32(6.5), locked: ['exponent', 'mantissa'] },
        goal: { value: -6.5 }, example: { bits: f32(-6.5) },
        prompt: `הצצה לשיעור הבא: מספרים ממשיים נשמרים ב-32 ביטים, בשיטת סימן וגודל. הביט הוורוד הוא ביט הסימן. הפכו את ${ltr('6.5')} ל-${ltr('−6.5')}: בלי משלים, בלחיצה אחת.`,
      }),
      {
        id: 'recap', kind: 'recap',
        points: [
          `חיבור בינארי הוא חיבור בעמודות עם נשא: ${ltr('1 + 1 = 10')}.`,
          'ברוחב קבוע נשא סופי נזרק. במספרים ללא סימן הוא מסמן גלישה.',
          `במשלים ל-2 הביט השמאלי שוקל ${ltr('−2ⁿ⁻¹')}. מספר נגדי: הופכים את כל הביטים ומוסיפים 1.`,
          'חיסור הוא חיבור של המשלים ל-2, בלי הנשא הסופי.',
          'עם סימן יש גלישה כשהנשא שנכנס לביט הסימן שונה מהנשא שיוצא ממנו, למשל כששני חיוביים נותנים שלילי.',
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: `מה הסכום ${ltr('(0111)₂ + (0001)₂')} ברוחב 4 ביטים?`, options: ['0110', '1000', '1111'], correct: 1 },
      { id: 'q2', prompt: 'מה הטווח של מספרים עם סימן במשלים ל-2 ברוחב 8 ביטים?', options: ['0 עד 255', `${ltr('−127')} עד 127`, `${ltr('−128')} עד 127`, `${ltr('−255')} עד 255`], correct: 2 },
      { id: 'q3', prompt: `מה המשלים ל-2 של ${ltr('00101100')} ברוחב 8 ביטים?`, options: ['11010011', '11010101', '11010100', '00101101'], correct: 2 },
      { id: 'q4', prompt: `מה הערך של ${ltr('11111111')} כמספר עם סימן ברוחב 8 ביטים?`, options: [ltr('−127'), ltr('−1'), '255', ltr('−128')], correct: 1 },
      { id: 'q5', prompt: 'מחברים שני מספרים חיוביים עם סימן, והתוצאה יצאה שלילית. מה זה אומר?', options: ['אין בעיה, זה קורה', 'הייתה גלישה: הסכום לא נכנס בטווח', 'המספרים היו בעצם ללא סימן'], correct: 1 },
      { id: 'q6', prompt: `איך מחשבים ${ltr('A − B')} בעזרת חיבור במשלים ל-2?`, options: [`מחברים ל-A את B ומוסיפים 1`, 'מחברים ל-A את המשלים ל-2 של B וזורקים את הנשא הסופי', 'מחברים ל-A את הביטים ההפוכים של B, בלי להוסיף 1'], correct: 1 },
      { id: 'q7', prompt: `ברוחב 4 ביטים ${ltr('1000')} הוא ${ltr('−8')}. מה יוצא כשמחשבים את המשלים ל-2 שלו?`, options: [`${ltr('1000')} שוב, כי 8 לא נכנס בטווח`, `${ltr('0111')}, כלומר 7`, `${ltr('1000')} שהוא עכשיו 8`], correct: 0 },
    ],
  },

  // ───────────────────────────── 2.2 ─────────────────────────────
  {
    id: 'sw-2-l2', stage: 'sw-2-arith', order: 2,
    title: `נקודה צפה ${ltr('(IEEE-754)')}`, minutes: 10,
    blurb: 'סימן, מעריך ומנטיסה: איך 32 ביטים שומרים מספר ממשי.',
    source: syl(2),
    steps: [
      {
        id: 'sci', kind: 'explain',
        text: `בכתיב מדעי כותבים ${ltr('1,500,000 = 1.5 · 10⁶')}: ספרה אחת לפני הנקודה, ומעריך שאומר לאן הנקודה "צפה". בבינארי עושים אותו דבר עם חזקות של 2: ${ltr('6.25 = 110.01₂ = 1.1001₂ · 2²')}. כאן הנקודה זזה שני מקומות. ובבינארי הספרה שלפני הנקודה היא תמיד 1.`,
      },
      {
        id: 'fields', kind: 'explain', figure: 's2-ieee',
        text: `בתקן IEEE-754 (32 ביטים) יש שלושה שדות: סימן S (ביט אחד), מעריך E (8 ביטים) ומנטיסה M (23 ביטים), שהיא הספרות שאחרי הנקודה. את ה-1 שלפני הנקודה לא שומרים, כי הוא תמיד שם: זה הביט החבוי. המעריך נשמר בתוספת היסט ${ltr('(bias)')} של 127, כדי לא להזדקק לשליליים: ${ltr('E = e + 127')}.`,
      },
      widgetStep({
        id: 'explore', widget: 'BitField', config: { bits: f32(1) },
        prompt: 'זו המילה של המספר 1. לחצו על ביטים וצפו בחישוב שמתחת. מה קורה כשמדליקים ביט במנטיסה? ומה כשמשנים ביט במעריך? נסו גם להזיז את הנקודה.',
      }),
      {
        id: 'bias-check', kind: 'check',
        prompt: `בשדה המעריך שמור ${ltr('10000100')}, כלומר 132. מהו המעריך האמיתי e?`,
        options: ['132', '5', ltr('−5'), '259'],
        correct: 1,
        feedback: [
          '132 הוא הערך השמור, E. כדי לקבל את המעריך האמיתי מחסירים את ההיסט 127.',
          `נכון: ${ltr('e = E − 127 = 132 − 127 = 5')}, כלומר הערך מוכפל ב-${ltr('2⁵')}.`,
          `הכיוון הפוך: מחסירים את 127 מ-E, לא את E מ-127. ${ltr('132 − 127 = 5')}.`,
          `הוספת 127 היא כיוון הקידוד, ${ltr('E = e + 127')}. כשקוראים את השדה מחסירים.`,
        ],
      },
      widgetStep({
        id: 'exp-goal', widget: 'BitField',
        config: { bits: f32(1), locked: ['sign', 'mantissa'] },
        goal: { value: 0.25 }, example: { bits: f32(0.25) },
        prompt: `עכשיו רק המעריך פתוח. בנו את ${ltr('0.25')}. רמז: ${ltr('0.25 = 2⁻²')}, כלומר e שלילי, ולכן E קטן מ-127.`,
      }),
      {
        id: 'mantissa', kind: 'explain',
        text: `המנטיסה היא מה שאחרי הנקודה ב-${ltr('1.M')}. הביט הראשון שלה שווה חצי, השני רבע, השלישי שמינית וכן הלאה. לכן מנטיסה ${ltr('101')} ואחריה אפסים היא ${ltr('1.101₂ = 1 + 1/2 + 1/8 = 1.625')}. בלי הביט החבוי היינו מקבלים רק ${ltr('0.625')}.`,
      },
      {
        id: 'mantissa-check', kind: 'check',
        prompt: `שלושת הביטים הראשונים של המנטיסה הם ${ltr('011')}, ושאר הביטים אפס. מה ערך ${ltr('1.M')}?`,
        options: ['1.75', '1.375', '0.375', '1.011'],
        correct: 1,
        feedback: [
          `${ltr('1.75')} הוא ${ltr('1.11₂')}: נתתם לשתי האחדות את המשקלים חצי ורבע. אבל הן בביט השני והשלישי, ולכן הן שוות רבע ושמינית.`,
          `נכון: ${ltr('1 + 1/4 + 1/8 = 1.375')}.`,
          `זה החישוב בלי הביט החבוי. ${ltr('1.M')} מתחיל ב-1, ולכן מוסיפים אותו: ${ltr('1 + 0.375')}.`,
          'קראתם את הביטים כאילו הם ספרות עשרוניות. כל ביט שווה חצי מהביט שמשמאלו, ולכן סוכמים את המשקלים.',
        ],
      },
      widgetStep({
        id: 'man-goal', widget: 'BitField',
        config: { bits: f32(1), locked: ['sign', 'exponent'] },
        goal: { value: 1.875 }, example: { bits: f32(1.875) },
        prompt: `עכשיו רק המנטיסה פתוחה. בנו את ${ltr('1.875')}. כמה חצאים, רבעים ושמיניות צריך כדי להגיע ל-${ltr('0.875')}?`,
      }),
      {
        id: 'recipe', kind: 'explain',
        text: `כך מקודדים ${ltr('10.5')}: הוא חיובי, ולכן ${ltr('S = 0')}. בבינארי ${ltr('10.5 = 1010.1₂ = 1.0101₂ · 2³')}, כלומר ${ltr('e = 3')} ו-${ltr('E = 3 + 127 = 130 = 10000010₂')}. המנטיסה היא ${ltr('0101')} ואחריה אפסים, בלי ה-1 החבוי. כל המילה בהקסדצימלי: ${ltr('41280000')}.`,
      },
      {
        id: 'special', kind: 'explain',
        text: `שני ערכי מעריך שמורים למקרים מיוחדים. כש-${ltr('E = 0')} והמנטיסה אפס, המילה היא 0 (כל הביטים אפס). כש-${ltr('E = 255')} והמנטיסה אפס זה אינסוף, ואחרת ${ltr('NaN')}, "לא מספר". גם ${ltr('E = 0')} עם מנטיסה אחרת הוא מקרה מיוחד. מספר נורמלי הוא כל מילה עם E בין 1 ל-254, ובהם נעסוק.`,
      },
      widgetStep({
        id: 'build', widget: 'BitField', config: {},
        goal: { value: -6.25 }, example: { bits: f32(-6.25) },
        prompt: `כל הביטים פתוחים, ומתחילים מאפס. בנו את ${ltr('−6.25')}: סימן, אחר כך ${ltr('6.25')} בבינארי ונרמול, ואז E ומנטיסה.`,
      }),
      {
        id: 'exp-num', kind: 'check-number',
        prompt: `מהו ערך שדה המעריך E, בעשרוני, בייצוג של 20?`,
        answer: '131', compute: () => String(encodeIEEE754(20).exponent),
        feedbackWrong: `כתבו את 20 בבינארי ונרמלו לצורה ${ltr('1.xxx · 2^e')}. מצאו את e, ואז הוסיפו 127.`,
      },
      {
        id: 'decode', kind: 'try',
        prompt: `ובכיוון ההפוך: מילת IEEE-754 היא ${ltr('C1200000')} בהקסדצימלי. איזה מספר היא מייצגת?`,
        puzzle: {
          type: 'number', prompt: `כתבו את הערך העשרוני של ${ltr('0xC1200000')}`, answer: '-10', check: 'numeric',
          compute: () => String(decodeIEEE754(toBase(fromBase('C1200000', 16), 2).padStart(32, '0'))),
        },
        hints: [
          { text: `פרשו לבינארי, ${ltr('1100 0001 0010 0000…')}, וחלקו לשדות: ${ltr('1 | 10000010 | 0100…')}.` },
          { text: `סימן 1. ${ltr('E = 130')}, כלומר ${ltr('e = 3')}. המנטיסה ${ltr('01')} נותנת ${ltr('1.01₂ = 1.25')}.` },
          { text: `${ltr('−1.25 · 2³')}.` },
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `הערך הוא ${ltr('(−1)^S · 1.M · 2^(E − 127)')}.`,
          'סימן ביט אחד, מעריך 8 ביטים עם היסט 127, ומנטיסה 23 ביטים בלי הביט החבוי.',
          `קידוד: כותבים בבינארי, מנרמלים ל-${ltr('1.xxx · 2^e')}, ושומרים ${ltr('E = e + 127')}.`,
          `ביטי המנטיסה שווים חצי, רבע, שמינית וכן הלאה. ערכי ${ltr('E = 0')} ו-${ltr('E = 255')} שמורים למקרים מיוחדים.`,
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: 'כמה ביטים יש בשדה המעריך בתקן IEEE-754 של 32 ביטים?', options: ['5', '8', '11', '23'], correct: 1 },
      { id: 'q2', prompt: 'מהו ההיסט שמוסיפים למעריך האמיתי בתקן של 32 ביטים?', options: ['64', '127', '128', '255'], correct: 1 },
      { id: 'q3', prompt: `שדה המעריך הוא ${ltr('10000011')}. מהו המעריך האמיתי e?`, options: ['3', '4', '5', '131'], correct: 1 },
      { id: 'q4', prompt: `המנטיסה היא 1 ואחריו אפסים. מה ערך ${ltr('1.M')}?`, options: ['1.1', '1.5', '2', '0.5'], correct: 1 },
      { id: 'q5', prompt: `במילה ${ltr('S = 0')}, ${ltr('E = 127')} וכל ביטי המנטיסה אפס. מה הערך?`, options: ['0', '1', '2', '127'], correct: 1 },
      { id: 'q6', prompt: `מה הערך של המילה ${ltr('0 | 10000000 | 1000…0')}?`, options: ['1.5', '3', '6', '128'], correct: 1 },
      { id: 'q7', prompt: `למה לא שומרים את ה-1 שלפני הנקודה ב-${ltr('1.M')}?`, options: ['כי במספר נורמלי הוא תמיד 1, ואפשר לחסוך ביט', 'כי הוא תמיד 0', 'כי הוא חלק משדה הסימן'], correct: 0 },
    ],
  },

  // ───────────────────────────── 2.3 ─────────────────────────────
  {
    id: 'sw-2-l3', stage: 'sw-2-arith', order: 3,
    title: 'קודים: BCD, גריי וזוגיות, וקוד שמוגדר בנוסחה', minutes: 9,
    blurb: 'אותו מידע בביטים אחרים: לצגים, לחיישנים ולגילוי שגיאות.',
    source: syl(2),
    steps: [
      {
        id: 'codes', kind: 'explain',
        text: `קוד הוא כלל שמתרגם מידע לרצף ביטים. בינארי רגיל הוא קוד אחד, ויש קודים לצרכים אחרים: BCD לצגים עשרוניים, גריי לחיישני מיקום, וביט זוגיות לגילוי שגיאות. ב-BCD כל ספרה עשרונית נכתבת לבד, בארבעה ביטים: ${ltr('59')} הוא ${ltr('0101 1001')}. הצירופים ${ltr('1010')} עד ${ltr('1111')} לא בשימוש.`,
      },
      {
        id: 'bcd-check', kind: 'check',
        prompt: `מהו הייצוג של 47 ב-BCD?`,
        options: ['0111 0100', '101111', '0100 0111'],
        correct: 2,
        feedback: [
          `הספרות יצאו בסדר הפוך. הספרה הגבוהה, 4, באה ראשונה: ${ltr('0100')}, ואחריה 7: ${ltr('0111')}.`,
          `זה 47 בבינארי רגיל. ב-BCD כל ספרה עשרונית מקבלת ארבעה ביטים משלה: 4 הוא ${ltr('0100')} ו-7 הוא ${ltr('0111')}.`,
          `נכון: 4 הוא ${ltr('0100')} ו-7 הוא ${ltr('0111')}.`,
        ],
      },
      widgetStep({
        id: 'binary', widget: 'BaseConvert', config: { from: 10, to: 2, value: '59', mode: 'divide' },
        prompt: `השוו לבינארי רגיל: המירו את 59 בחלוקות חוזרות ב-2. מתקבל ${ltr('111011')}, ששונה לגמרי מ-${ltr('0101 1001')} של BCD. אלה שני קודים לאותו מספר.`,
      }),
      {
        id: 'gray', kind: 'explain',
        text: `בקוד גריי שני ערכים סמוכים נבדלים בביט אחד בלבד. זה חשוב לחיישן מיקום: במעבר מ-${ltr('0111')} ל-${ltr('1000')} בבינארי מתהפכים ארבעה ביטים, ואם הם לא משתנים באותו רגע אפשר לקרוא ערך שגוי. ההמרה: ${ltr('g3 = b3')}, והשאר ${ltr('g_i = b_i ⊕ b_(i+1)')}, כלומר XOR עם השכן השמאלי.`,
      },
      {
        id: 'gray-num', kind: 'check-number',
        prompt: `מהו קוד גריי של ${ltr('1011')}?`,
        answer: '1110', compute: () => toGray('1011'),
        feedbackWrong: `העתיקו את הביט השמאלי. לכל ביט אחר חשבו XOR עם הביט שמשמאלו: ${ltr('0 ⊕ 1')}, ${ltr('1 ⊕ 0')}, ${ltr('1 ⊕ 1')}.`,
      },
      {
        id: 'parity', kind: 'explain',
        text: `ביט זוגיות זוגית מוסיפים כך שמספר האחדות במילה כולה יהיה זוגי: ל-${ltr('1100101')}, עם ארבע אחדות, מוסיפים 0. ל-${ltr('1100111')}, עם חמש, מוסיפים 1. אם התקבלה מילה עם מספר אי-זוגי של אחדות, ודאי הייתה שגיאה. אבל הבדיקה לא אומרת איפה, ושני ביטים שהתהפכו לא יתגלו.`,
      },
      {
        id: 'parity-check', kind: 'check',
        prompt: `מילים נשלחות ב-8 ביטים בזוגיות זוגית, והביט האחרון הוא ביט הזוגיות. התקבלה המילה ${ltr('10110110')}. מה נכון?`,
        options: ['הכול תקין, כי ביט הזוגיות הוא 0', 'ודאי הייתה שגיאה, כי מספר האחדות במילה אי-זוגי', 'הייתה שגיאה, והיא בביט הזוגיות'],
        correct: 1,
        feedback: [
          'ביט הזוגיות לא נבדק לבד אלא יחד עם כל המילה. יש בה חמש אחדות, ומספר אי-זוגי אומר שמשהו התהפך.',
          'נכון: חמש אחדות הן מספר אי-זוגי, ולכן התהפך מספר אי-זוגי של ביטים.',
          'זוגיות מגלה שיש שגיאה, אבל לא איפה. כל ביט במילה, גם ביט הזוגיות, יכול להיות זה שהתהפך.',
        ],
      },
      {
        id: 'two-flips', kind: 'check',
        prompt: 'בדרך התהפכו בדיוק שני ביטים במילה שנשלחה בזוגיות זוגית. האם הבדיקה תגלה את השגיאה?',
        options: [
          'כן, תמיד: שתי שגיאות קל יותר לזהות מאחת',
          'לא: כל היפוך משנה את הזוגיות, ושני היפוכים מחזירים אותה',
          'כן, אבל רק אם אחד הביטים שהתהפכו הוא ביט הזוגיות',
        ],
        correct: 1,
        feedback: [
          `ההפך: שני היפוכים משנים את מספר האחדות ב-2, ב-0 או ב-${ltr('−2')}, והמספר נשאר זוגי. הבדיקה לא רואה כלום.`,
          'נכון: הזוגיות נשמרת, ולכן השגיאה עוברת בשקט. ביט זוגיות אחד מגלה רק מספר אי-זוגי של שגיאות.',
          'גם אם אחד מהם הוא ביט הזוגיות, שני היפוכים משאירים את מספר האחדות זוגי, והשגיאה לא מתגלה.',
        ],
      },
      {
        id: 'excess', kind: 'explain',
        text: `קוד אפשר להגדיר גם בנוסחה. בקוד עודף K שומרים ${ltr('c = x + K')} במקום x עצמו, וכך גם ערך שלילי נשמר כמספר רגיל. בארבעה ביטים עם ${ltr('K = 8')}: ${ltr('x = −3')} נשמר כ-${ltr('5 = 0101')}. ומפענחים ב-${ltr('x = c − K')}. מכירים? המעריך של IEEE-754 הוא קוד עודף 127.`,
      },
      {
        id: 'excess-check', kind: 'check',
        prompt: `בקוד עודף 8 ברוחב 4 ביטים שמור ${ltr('0110')}. איזה ערך x הוא מייצג?`,
        options: ['2', '6', ltr('−2'), '14'],
        correct: 2,
        feedback: [
          `הכיוון התהפך: חישבתם ${ltr('8 − 6')}. הנוסחה היא ${ltr('x = c − K = 6 − 8')}.`,
          `6 הוא c, ערך הביטים כמספר בינארי. כדי לקבל את x מחסירים את K.`,
          `נכון: ${ltr('x = c − K = 6 − 8 = −2')}.`,
          `הוספתם את K במקום להחסיר. מקודדים ב-${ltr('c = x + K')}, ולכן מפענחים ב-${ltr('x = c − K')}.`,
        ],
      },
      widgetStep({
        id: 'excess-goal', widget: 'BitField',
        config: { bits: f32(1), locked: ['sign', 'mantissa'] },
        goal: { value: 0.03125 }, example: { bits: f32(0.03125) },
        prompt: `שדה המעריך הוא קוד עודף 127. בנו את ${ltr('0.03125 = 2⁻⁵')}: מצאו את e, ואז שמרו ${ltr('E = e + 127')}.`,
      }),
      {
        id: 'formula', kind: 'explain',
        text: `כשקוד מוגדר בנוסחה לא מנחשים: מציבים לפי ההגדרה, ביט אחר ביט. במילה ${ltr('b3b2b1b0')} הביט ${ltr('b3')} הוא השמאלי. לדוגמה, אם ${ltr('q1 = b1 ⊕ b0')}, אז עבור ${ltr('0110')} מציבים ${ltr('b1 = 1')} ו-${ltr('b0 = 0')}, ומקבלים ${ltr('q1 = 1')}. כדאי לכתוב את האינדקסים מעל הביטים.`,
      },
      {
        id: 'code-try', kind: 'try',
        prompt: 'הקוד הבא מומצא ומוגדר בנוסחה. חשבו את מילות הקוד לפי ההגדרה בלבד, ושימו לב שזה לא קוד גריי.',
        puzzle: {
          type: 'code',
          definition: `קוד שכנים (מומצא): לכל מילה b3b2b1b0, כש-b3 הוא ה-MSB, מילת הקוד היא q3q2q1q0:\n${ltr('q3 = b3 ⊕ b2')}\n${ltr('q2 = b2 ⊕ b1')}\n${ltr('q1 = b1 ⊕ b0')}\n${ltr('q0 = b0')}`,
          encode: encodeNeighbour,
          inputs: ['0110', '1011', '1101'],
        },
        hints: [
          { text: `${ltr('q0')} הוא פשוט ${ltr('b0')}. כל ביט אחר הוא XOR של הביט באותו מקום והביט שמימינו.` },
          { text: `עבור ${ltr('0110')}: ${ltr('q3 = 0 ⊕ 1 = 1')}, ${ltr('q2 = 1 ⊕ 1 = 0')}, ${ltr('q1 = 1 ⊕ 0 = 1')}, ${ltr('q0 = 0')}.` },
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `BCD: כל ספרה עשרונית בארבעה ביטים משלה. ${ltr('59 → 0101 1001')}, וזה לא הבינארי של 59.`,
          `קוד גריי: ערכים סמוכים נבדלים בביט אחד. ${ltr('g3 = b3')} ו-${ltr('g_i = b_i ⊕ b_(i+1)')}.`,
          'ביט זוגיות זוגית משלים את מספר האחדות לזוגי. הוא מגלה מספר אי-זוגי של שגיאות, ולא אומר איפה הן.',
          `קוד בנוסחה: מציבים ביט אחר ביט. בקוד עודף ${ltr('c = x + K')}, ולכן ${ltr('x = c − K')}.`,
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: 'מהו הייצוג של 905 ב-BCD?', options: ['1001 0000 0101', '1110001001', '0101 0000 1001'], correct: 0 },
      { id: 'q2', prompt: 'כמה ביטים דרושים ב-BCD למספר עשרוני בן ארבע ספרות?', options: ['10', '12', '14', '16'], correct: 3 },
      { id: 'q3', prompt: `מהו קוד גריי של ${ltr('1100')}?`, options: ['1010', '1100', '0110', '1000'], correct: 0 },
      { id: 'q4', prompt: 'מה מייחד את קוד גריי?', options: ['שני ערכים עוקבים נבדלים בביט אחד בלבד', 'הוא קצר יותר מבינארי רגיל', 'הוא מגלה שגיאות, כמו ביט זוגיות'], correct: 0 },
      { id: 'q5', prompt: 'מילה בזוגיות זוגית התקבלה עם שש אחדות. מה אפשר להסיק?', options: ['בוודאות לא הייתה שגיאה', 'בוודאות הייתה שגיאה', 'לא הייתה שגיאה, או שהתהפך מספר זוגי של ביטים'], correct: 2 },
      { id: 'q6', prompt: `בקוד עודף 8 ברוחב 4 ביטים, איזו מילה מייצגת את ${ltr('−5')}?`, options: ['0101', '0011', '1011', '1101'], correct: 1 },
      { id: 'q7', prompt: `איזה מספר עשרוני מייצגת המילה ${ltr('0001 0010')} ב-BCD?`, options: ['12', '18', '3'], correct: 0 },
    ],
  },
]

/** A 4-bit two's-complement ring: 16 codes around a circle with their signed values (built once, static markup). */
function ring(): string {
  const cx = 160, cy = 148, r = 104
  const parts: string[] = []
  const at = (k: number, rad: number) => {
    const a = (k / 16) * 2 * Math.PI - Math.PI / 2
    return `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`
  }
  // the wrap from 0111 (7) to 1000 (−8): where overflow happens
  const arc = `M ${at(7, r)} A ${r} ${r} 0 0 1 ${at(8, r)}`
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * 2 * Math.PI - Math.PI / 2
    const x = (rad: number) => (cx + rad * Math.cos(a)).toFixed(1)
    const y = (rad: number) => (cy + rad * Math.sin(a)).toFixed(1)
    const v = k < 8 ? k : k - 16
    const col = v < 0 ? 'var(--g1)' : 'var(--one)'
    parts.push(`<circle cx="${x(r)}" cy="${y(r)}" r="5" fill="${col}"/>`)
    parts.push(`<text x="${x(r - 26)}" y="${y(r - 26)}" font-size="10" fill="var(--muted)" dominant-baseline="middle">${k.toString(2).padStart(4, '0')}</text>`)
    parts.push(`<text x="${x(r + 20)}" y="${y(r + 20)}" font-size="13" font-weight="700" fill="${col}" dominant-baseline="middle">${String(v).replace('-', '−')}</text>`)
  }
  return `<svg viewBox="0 0 320 296" role="img" aria-label="ארבעה ביטים במשלים ל-2 על מעגל: 0000 עד 0111 הם 0 עד 7, ו-1000 עד 1111 הם מינוס 8 עד מינוס 1" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="2"/>
    <path d="${arc}" fill="none" stroke="var(--amber)" stroke-width="4" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 6}" font-size="12" fill="var(--amber)">7 + 1 → −8</text>
    <text x="${cx}" y="${cy + 12}" font-size="11" fill="var(--muted)">4 bits</text>
    ${parts.join('\n    ')}
  </g>
</svg>`
}

/** Inline SVG figures for this stage's explain steps, by id (prefixed "s2-"). Colours come from theme tokens. */
export const figures: Figures = {
  's2-add': `<svg viewBox="0 0 300 168" role="img" aria-label="חיבור בעמודות: 0101 ועוד 0011 שווה 1000, עם נשא בשלוש עמודות" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <text x="40" y="26" font-size="12" fill="var(--amber)">carry</text>
    <text x="100" y="28" font-size="18" font-weight="700" fill="var(--amber)">1</text>
    <text x="150" y="28" font-size="18" font-weight="700" fill="var(--amber)">1</text>
    <text x="200" y="28" font-size="18" font-weight="700" fill="var(--amber)">1</text>
    <path d="M 238 40 Q 225 22 210 26" fill="none" stroke="var(--amber)" stroke-width="1.5"/>
    <path d="M 188 40 Q 175 22 160 26" fill="none" stroke="var(--amber)" stroke-width="1.5"/>
    <path d="M 138 40 Q 125 22 110 26" fill="none" stroke="var(--amber)" stroke-width="1.5"/>
    <text x="100" y="70" font-size="26" fill="var(--text)">0</text>
    <text x="150" y="70" font-size="26" fill="var(--text)">1</text>
    <text x="200" y="70" font-size="26" fill="var(--text)">0</text>
    <text x="250" y="70" font-size="26" fill="var(--text)">1</text>
    <text x="50" y="106" font-size="26" fill="var(--muted)">+</text>
    <text x="100" y="106" font-size="26" fill="var(--text)">0</text>
    <text x="150" y="106" font-size="26" fill="var(--text)">0</text>
    <text x="200" y="106" font-size="26" fill="var(--text)">1</text>
    <text x="250" y="106" font-size="26" fill="var(--text)">1</text>
    <line x1="70" y1="120" x2="280" y2="120" stroke="var(--border)" stroke-width="2"/>
    <text x="100" y="154" font-size="26" font-weight="700" fill="var(--one)">1</text>
    <text x="150" y="154" font-size="26" font-weight="700" fill="var(--one)">0</text>
    <text x="200" y="154" font-size="26" font-weight="700" fill="var(--one)">0</text>
    <text x="250" y="154" font-size="26" font-weight="700" fill="var(--one)">0</text>
  </g>
</svg>`,
  's2-ring': ring(),
  's2-ieee': `<svg viewBox="0 0 340 126" role="img" aria-label="מילת IEEE-754: סימן ביט אחד, מעריך 8 ביטים, מנטיסה 23 ביטים" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <rect x="10" y="20" width="30" height="44" rx="6" fill="none" stroke="var(--g1)" stroke-width="2"/>
    <rect x="44" y="20" width="96" height="44" rx="6" fill="none" stroke="var(--amber)" stroke-width="2"/>
    <rect x="144" y="20" width="186" height="44" rx="6" fill="none" stroke="var(--g2)" stroke-width="2"/>
    <text x="25" y="48" font-size="18" font-weight="700" fill="var(--g1)">S</text>
    <text x="92" y="48" font-size="18" font-weight="700" fill="var(--amber)">E</text>
    <text x="237" y="48" font-size="18" font-weight="700" fill="var(--g2)">M</text>
    <text x="25" y="13" font-size="11" fill="var(--muted)">1</text>
    <text x="92" y="13" font-size="11" fill="var(--muted)">8</text>
    <text x="237" y="13" font-size="11" fill="var(--muted)">23</text>
    <text x="170" y="100" font-size="16" fill="var(--text)">(−1)<tspan font-size="11" dy="-7">S</tspan><tspan dy="7"> · 1.M · 2</tspan><tspan font-size="11" dy="-7">E−127</tspan></text>
  </g>
</svg>`,
}
