import type { Figures, Lesson } from '../../lessons/types'
import { complementR, complementR1, digitsValue, findBases, fromBase, toBase } from '../../../logic/numbers'
import { ltr } from '../helpers'
import { widgetStep } from '../../lessons/widgetTypes'
import { syl } from '../syllabus'

/**
 * Stage 1 lessons (מספרים ובסיסים): 1.1 place value and bases, 1.2 conversions between bases,
 * 1.3 complements and subtraction. Every number a step states is derived in tests/content/lessons-stage1.test.ts.
 */
export const lessons: Lesson[] = [
  // ───────────────────────── 1.1 ─────────────────────────
  {
    id: 'sw-1-l1', stage: 'sw-1-numbers', order: 1,
    title: 'מה זה בסיס? ערך המקום', minutes: 8,
    blurb: 'כל ספרה שווה לפי המקום שלה: מעשרוני לבינארי ולהקסדצימלי, ואיך מוצאים בסיס לא ידוע.',
    source: syl(1),
    steps: [
      {
        id: 'place', kind: 'explain', figure: 's1-place',
        text: `כשקוראים 345 קוראים שלוש מאות וארבעים וחמש, לא "שלוש, ארבע, חמש". הספרה 3 שווה 300 כי היא יושבת במקום המאות. כל מקום שווה פי 10 מהמקום שמימינו: ${ltr('345 = 3·100 + 4·10 + 5·1')}.`,
      },
      widgetStep({
        id: 'dial10', widget: 'BaseDial', config: { base: 10, width: 3 },
        prompt: 'סובבו את הספרות עד שתקבלו 207. שימו לב מה עושה האפס: הוא לא תורם כלום, אבל שומר את מקום העשרות ריק.',
        goal: { value: 207 }, example: { digits: [2, 0, 7] },
      }),
      {
        id: 'base-r', kind: 'explain', figure: 's1-weights',
        text: `בסיס הוא מספר הספרות שבהן כותבים. בבסיס 10 יש עשר ספרות, ובבסיס r יש r ספרות, מ-0 עד ${ltr('r − 1')}, וכל מקום שווה פי r מהמקום שמימינו. מחשבים בנויים ממתגים עם שני מצבים, ולכן הם כותבים בבסיס 2. ספרה בינארית, 0 או 1, נקראת ביט.`,
      },
      widgetStep({
        id: 'dial2', widget: 'BaseDial', config: { base: 2, width: 6 },
        prompt: 'בבסיס 2 יש רק 0 ו-1, והמשקלים מימין לשמאל הם 1, 2, 4, 8, 16, 32. בנו את 45: בחרו אילו משקלים להדליק כך שסכומם 45.',
        goal: { value: 45 }, example: { digits: [1, 0, 1, 1, 0, 1] },
      }),
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
        id: 'hex', kind: 'explain',
        text: `מה קורה כשהבסיס גדול מ-10? אין ספרה אחת לערך עשר, ולכן משתמשים באותיות: ${ltr('A = 10')}, ${ltr('B = 11')} וכן הלאה עד ${ltr('F = 15')}. בבסיס 16 יש 16 ספרות: 0 עד 9 ואחריהן A עד F. למשל ${ltr('(1A)₁₆ = 1·16 + 10 = 26')}.`,
      },
      widgetStep({
        id: 'dial16', widget: 'BaseDial', config: { base: 16, width: 2 },
        prompt: 'כל מקום כאן שווה פי 16 מהמקום שמימינו. הגיעו ל-171, והשתמשו בספרות A עד F לפי הצורך.',
        goal: { value: 171 }, example: { digits: [10, 11] },
      }),
      {
        id: 'to-dec', kind: 'check-number',
        prompt: `כמה שווה ${ltr('(2A)₁₆')} בבסיס 10?`,
        answer: '42', compute: () => String(fromBase('2A', 16)),
        feedbackWrong: `הספרה A שווה 10 והיא במקום היחידות, והספרה 2 יושבת במקום ה-16: ${ltr('2·16 + 10')}.`,
      },
      {
        id: 'legal', kind: 'check',
        prompt: 'איזו מהמחרוזות הבאות לא יכולה להיות מספר בבסיס 5?',
        options: ['3421', '1204', '2530', '4000'],
        correct: 2,
        feedback: [
          'כל הספרות כאן קטנות מ-5 (הגדולה בהן היא 4), ולכן זה מספר חוקי בבסיס 5.',
          'הספרות 1, 2, 0, 4 כולן בין 0 ל-4, ולכן זה מספר חוקי בבסיס 5.',
          'נכון: בבסיס 5 הספרות הן 0 עד 4, ובמחרוזת הזו יש את הספרה 5.',
          'הספרה 4 היא הגדולה ביותר שמותרת בבסיס 5, ואפסים תמיד מותרים, ולכן זה מספר חוקי.',
        ],
      },
      {
        id: 'find-r', kind: 'explain',
        text: `במבחן נותנים לפעמים משוואה בלי לומר מהו הבסיס. פותחים כל מספר לפי ערכי המקום ופותרים. למשל ${ltr('(24)_r = (14)₁₀')} נותן ${ltr('2r + 4 = 14')}, ולכן ${ltr('r = 5')}. בסוף בודקים שכל ספרה קטנה מ-r.`,
      },
      {
        id: 'find-r-num', kind: 'check-number',
        prompt: `מצאו את r: ${ltr('(31)_r = (16)₁₀')}`,
        answer: '5', compute: () => findBases(r => digitsValue('31', r), () => 16, 4).join(','),
        feedbackWrong: `פתחו לפי ערכי המקום: ${ltr('(31)_r = 3r + 1')}, והשוו ל-16.`,
      },
      {
        id: 'try-r', kind: 'try',
        prompt: 'עכשיו משוואה בסגנון מבחן. כל המספרים כתובים באותו בסיס r.',
        puzzle: {
          type: 'number', prompt: `מצאו את r: ${ltr('(13)_r + (24)_r = (41)_r')}`, answer: '6', check: 'numeric',
          compute: () => findBases(r => digitsValue('13', r) + digitsValue('24', r), r => digitsValue('41', r), 5).join(','),
        },
        hints: [
          { text: `פתחו כל מספר לפי ערכי המקום: ${ltr('(13)_r = r + 3')} ו-${ltr('(24)_r = 2r + 4')}.` },
          { text: `קיבלתם ${ltr('3r + 7 = 4r + 1')}. פתרו, ובדקו שהספרה הגדולה ביותר, 4, קטנה מ-r.` },
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `ערך של ספרה הוא הספרה כפול משקל המקום שלה, והמשקלים הם ${ltr('1, r, r², r³')} וכן הלאה.`,
          `בבסיס r הספרות הן 0 עד ${ltr('r − 1')}. מעל 9 כותבים A עד F.`,
          'מבסיס r לעשרוני: מכפילים כל ספרה במשקל שלה וסוכמים.',
          'בסיס לא ידוע: פותחים לפי ערכי המקום, פותרים, ובודקים שכל ספרה קטנה מ-r.',
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: `כמה שווה ${ltr('(101101)₂')} בבסיס 10?`, options: ['43', '45', '47', '101101'], correct: 1 },
      { id: 'q2', prompt: 'אילו ספרות מותרות בבסיס 8?', options: ['0 עד 8', '1 עד 8', '0 עד 7', '0 ו-1 בלבד'], correct: 2 },
      { id: 'q3', prompt: 'כמה שווה המקום השלישי מימין בבסיס 5?', options: ['5', '15', '25', '125'], correct: 2 },
      { id: 'q4', prompt: `כמה שווה ${ltr('(2A)₁₆')} בבסיס 10?`, options: ['26', '32', '210', '42'], correct: 3 },
      { id: 'q5', prompt: `אם ${ltr('(24)_r = (14)₁₀')}, מהו r?`, options: ['4', '5', '6', '7'], correct: 1 },
      { id: 'q6', prompt: 'מהו המספר הגדול ביותר שאפשר לכתוב בשלוש ספרות בבסיס 2? (בעשרוני)', options: ['6', '7', '8', '9'], correct: 1 },
      { id: 'q7', prompt: 'פי כמה גדל משקל המקום כשזזים מקום אחד שמאלה בבסיס 16?', options: ['פי 2', 'פי 10', 'פי 16', 'פי 4'], correct: 2 },
    ],
  },

  // ───────────────────────── 1.2 ─────────────────────────
  {
    id: 'sw-1-l2', stage: 'sw-1-numbers', order: 2,
    title: 'המרות בין בסיסים', minutes: 8,
    blurb: 'מעשרוני לכל בסיס בחלוקות חוזרות, ובין בינארי, אוקטלי והקסדצימלי בקיבוץ ביטים.',
    source: syl(1),
    steps: [
      {
        id: 'why-divide', kind: 'explain',
        text: 'עד עכשיו עברנו מבסיס r לעשרוני. בכיוון ההפוך, מעשרוני לבסיס r, מחלקים ב-r, רושמים את השארית, ומחלקים שוב את המנה, עד שהמנה מתאפסת. השאריות הן הספרות של התוצאה.',
      },
      widgetStep({
        id: 'divide2', widget: 'BaseConvert', config: { from: 10, to: 2, value: '45', mode: 'divide' },
        prompt: 'המירו את 45 לבסיס 2. לחצו על "בצע חלוקה" שוב ושוב וצפו בשאריות נוחתות במקומן, או הפעילו הכול.',
        goal: { finished: true }, example: { step: 6, result: '101101', finished: true },
      }),
      {
        id: 'why-works', kind: 'explain',
        text: `למה זה עובד? ${ltr('45 = 22·2 + 1')}. כל כפולה של 2 מסתיימת בבסיס 2 בספרה 0, ולכן השארית 1 היא בדיוק ספרת היחידות. המנה 22 היא אותו מספר אחרי שמזיזים אותו מקום אחד ימינה, ואז אותו שיקול חוזר. לכן השארית הראשונה היא הספרה הימנית.`,
      },
      {
        id: 'rem-meaning', kind: 'check',
        prompt: 'חילקנו את 45 ב-2 וקיבלנו מנה 22 ושארית 1. מה מייצגת השארית 1?',
        options: [
          'את הספרה הימנית ביותר של התוצאה',
          'את הספרה השמאלית ביותר של התוצאה',
          'את מספר החלוקות שנותרו',
          'את ערך המנה',
        ],
        correct: 0,
        feedback: [
          'נכון: אחרי שמוציאים את כל הזוגות, מה שנשאר הוא ספרת היחידות.',
          'השארית הראשונה היא הספרה הימנית. הספרה השמאלית היא השארית האחרונה, זו שמתקבלת כשהמנה כבר קטנה מהבסיס.',
          'מספר החלוקות נקבע לפי גודל המספר, והוא שווה למספר הספרות בתוצאה. השארית היא ספרה אחת ולא מונה.',
          'ערך המנה הוא 22, והוא ממשיך להתחלק. השארית היא ספרה אחת של התוצאה, לא ערך.',
        ],
      },
      widgetStep({
        id: 'divide8', widget: 'BaseConvert', config: { from: 10, to: 8, value: '100', mode: 'divide' },
        prompt: 'אותה שיטה בבסיס אחר: המירו את 100 לבסיס 8. מחלקים ב-8, ולכן כל שארית היא ספרה בין 0 ל-7.',
        goal: { finished: true }, example: { step: 3, result: '144', finished: true },
      }),
      {
        id: 'to-bin', kind: 'check-number',
        prompt: 'כתבו את 37 בבסיס 2.',
        answer: '100101', compute: () => toBase(37, 2),
        feedbackWrong: `שימו לב לסדר: השארית הראשונה היא הספרה הימנית, והאחרונה היא השמאלית. המנות הן ${ltr('37 → 18 → 9 → 4 → 2 → 1 → 0')}.`,
      },
      {
        id: 'group-why', kind: 'explain', figure: 's1-groups',
        text: `בסיסים 8 ו-16 הם חזקות של 2: ${ltr('8 = 2³')} ו-${ltr('16 = 2⁴')}. לכן ספרה אוקטלית היא בדיוק 3 ביטים, וספרה הקסדצימלית היא בדיוק 4 ביטים. אין צורך בחלוקות: מקבצים ביטים מימין לשמאל, ומשלימים באפסים משמאל.`,
      },
      widgetStep({
        id: 'bin-hex', widget: 'BaseConvert', config: { from: 2, to: 16, value: '1101111011', mode: 'group' },
        prompt: 'המירו את הבינארי להקסדצימלי: צרו קבוצות של 4 ביטים מימין. האפסים שמשלימים את הקבוצה השמאלית דהויים.',
        goal: { finished: true }, example: { step: 3, result: '37B', finished: true },
      }),
      widgetStep({
        id: 'hex-bin', widget: 'BaseConvert', config: { from: 16, to: 2, value: '2F9', mode: 'group' },
        prompt: 'ועכשיו בחזרה: כל ספרה הקסדצימלית נפתחת לארבעה ביטים.',
        goal: { finished: true }, example: { step: 3, result: '1011111001', finished: true },
      }),
      {
        id: 'via2', kind: 'check',
        prompt: 'מ-8 ל-16 אין קיבוץ ישיר, כי 3 ביטים לא מתחלקים ל-4. איך ממירים מהר מבסיס 8 לבסיס 16?',
        options: [
          'פורשים כל ספרה אוקטלית ל-3 ביטים, ומקבצים את כל הביטים מחדש לרביעיות',
          'מחליפים כל ספרה אוקטלית בספרה הקסדצימלית שווה הערך',
          'אי אפשר בלי לעבור דרך בסיס 10',
          'מחלקים ב-2 שוב ושוב',
        ],
        correct: 0,
        feedback: [
          'נכון: בסיס 2 הוא הגשר, כי גם 8 וגם 16 הם חזקות שלו.',
          `ספרה אוקטלית היא 3 ביטים וספרה הקסדצימלית היא 4 ביטים, ולכן ספרה אחת לא מתאימה לספרה אחת. למשל ${ltr('(17)₈ = 1111₂ = (F)₁₆')}.`,
          'אפשר גם דרך בסיס 10, אבל זה איטי וחשבוני יותר. בסיס 2 הוא הגשר הטבעי כי שני הבסיסים הם חזקות שלו.',
          'חלוקות ב-2 נותנות ספרות בינאריות ולא הקסדצימליות. עדיין צריך לקבץ אותן, ולכן זה לא קיצור.',
        ],
      },
      {
        id: 'hex-bin-num', kind: 'check-number',
        prompt: `המירו את ${ltr('(D5)₁₆')} לבסיס 2 (8 ביטים).`,
        answer: '11010101', compute: () => toBase(fromBase('D5', 16), 2).padStart(8, '0'),
        feedbackWrong: `פתחו כל ספרה לארבעה ביטים: D שווה 13, כלומר ${ltr('1101')}, והספרה 5 היא ${ltr('0101')}.`,
      },
      {
        id: 'try-oct-hex', kind: 'try',
        prompt: 'עכשיו גשר שלם: מבסיס 8 לבסיס 16, דרך בינארי.',
        puzzle: {
          type: 'number', prompt: `כתבו את ${ltr('(35)₈')} בבסיס 16`, answer: '1D', check: 'exact',
          compute: () => toBase(fromBase('35', 8), 16),
        },
        hints: [
          { text: `פרשו כל ספרה אוקטלית לשלושה ביטים: ${ltr('3 → 011')} ו-${ltr('5 → 101')}.` },
          { text: `קיבלתם ${ltr('011101')}. קבצו אותם לרביעיות מימין והשלימו באפסים משמאל: ${ltr('0001 1101')}.` },
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          'מעשרוני לבסיס r: מחלקים ב-r שוב ושוב עד שהמנה 0. השאריות הן הספרות, והאחרונה היא השמאלית.',
          'השארית הראשונה היא ספרת היחידות, ולכן קוראים את השאריות מהסוף להתחלה.',
          'בסיסים 8 ו-16 הם חזקות של 2: ספרה אוקטלית היא 3 ביטים, והקסדצימלית 4 ביטים.',
          'בין 8 ל-16 עוברים דרך בינארי: פורשים לביטים ומקבצים מחדש.',
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: 'מהו הייצוג של 45 בבסיס 2?', options: ['101011', '110101', '101101', '101110'], correct: 2 },
      { id: 'q2', prompt: 'ממירים 100 לבסיס 8 בחלוקות חוזרות. באיזה סדר קוראים את השאריות?', options: ['מהראשונה לאחרונה', 'מהאחרונה לראשונה', 'מהגדולה לקטנה', 'בכל סדר, התוצאה זהה'], correct: 1 },
      { id: 'q3', prompt: 'כמה ביטים יש בכל ספרה הקסדצימלית?', options: ['2', '3', '4', '8'], correct: 2 },
      { id: 'q4', prompt: `מהו הייצוג ההקסדצימלי של ${ltr('(10110111)₂')}?`, options: ['7B', 'B7', 'A7', 'B6'], correct: 1 },
      { id: 'q5', prompt: `מהו הייצוג הבינארי של ${ltr('(5E)₁₆')} ב-8 ביטים?`, options: ['01111010', '10101110', '01011111', '01011110'], correct: 3 },
      { id: 'q6', prompt: `מהו הייצוג הבינארי של ${ltr('(17)₈')}?`, options: ['10111', '1111', '111', '11111'], correct: 1 },
      { id: 'q7', prompt: 'מהי הדרך המהירה להמיר מבסיס 16 לבסיס 8?', options: ['דרך בסיס 2: ארבעה ביטים לספרה, ואז שלושה ביטים לספרה', 'ספרה מול ספרה', 'דרך חלוקות ב-16', 'אי אפשר בלי מחשבון'], correct: 0 },
    ],
  },

  // ───────────────────────── 1.3 ─────────────────────────
  {
    id: 'sw-1-l3', stage: 'sw-1-numbers', order: 3,
    title: 'משלימים וחיסור', minutes: 10,
    blurb: `המשלים ל-r ול-${ltr('(r−1)')}, וחיסור בעזרת חיבור, כולל הנשא הסופי.`,
    source: syl(1),
    steps: [
      {
        id: 'why', kind: 'explain',
        text: 'חומרה מחברת בקלות ומחסרת בקושי. הטריק: במקום לחסר את B מחברים את המשלים שלו. המשלים נקבע על רוחב קבוע של n ספרות, ואפסים מובילים נספרים כספרות.',
      },
      widgetStep({
        id: 'r1-lab', widget: 'ComplementLab', config: { base: 10, digits: 5, value: '03726', mode: 'complement' },
        prompt: `המשלים ל-9 הופך כל ספרה d ל-${ltr('9 − d')}. לחצו על "הפכו כל ספרה" וראו שכל ספרה מתהפכת בנפרד, בלי העברות.`,
        goal: { phase: 'r1' }, example: { phase: 'r1' },
      }),
      {
        id: 'r1-num', kind: 'check-number',
        prompt: `מצאו את המשלים ל-9 של ${ltr('5072')} (ארבע ספרות).`,
        answer: '4927', compute: () => complementR1('5072', 10),
        feedbackWrong: 'חסרו כל ספרה מ-9 בנפרד, מימין לשמאל, בלי העברות בין הספרות.',
      },
      {
        id: 'r-expl', kind: 'explain',
        text: `המשלים ל-r הוא המשלים ל-${ltr('(r−1)')} ועוד 1. על n ספרות הוא שווה ל-${ltr('r^n − N')}. אם הספרות הימניות הן ${ltr('r − 1')}, ההוספה גוררת נשא (ה-1 שעובר לעמודה הבאה, כמו ב-${ltr('9 + 1')}) שמתגלגל שמאלה.`,
      },
      widgetStep({
        id: 'r-lab', widget: 'ComplementLab', config: { base: 2, digits: 6, value: '011010', mode: 'complement' },
        prompt: 'בבסיס 2 המשלים ל-1 הוא היפוך הביטים, והמשלים ל-2 הוא אותו היפוך ועוד 1. עברו את שני השלבים ועקבו אחרי הנשא.',
        goal: { phase: 'r' }, example: { phase: 'r' },
      }),
      {
        id: 'twos', kind: 'check',
        prompt: `מהו המשלים ל-2 של ${ltr('0110')} (ארבעה ביטים)?`,
        options: ['1001', '1010', '0110', '1000'],
        correct: 1,
        feedback: [
          'זה המשלים ל-1: רק הפכתם את הביטים. המשלים ל-2 דורש להוסיף עוד 1.',
          `נכון: ${ltr('1001 + 1 = 1010')}.`,
          'זה המספר המקורי. המשלים מתקבל מהיפוך הביטים, לא מהעתקה שלהם.',
          `הוספת 1 היא פעולה בכיוון ההפוך: ${ltr('1001 − 1 = 1000')}. כאן מוסיפים 1 ולא מחסרים.`,
        ],
      },
      {
        id: 'hex-comp', kind: 'check-number',
        prompt: `מצאו את המשלים ל-16 של ${ltr('(2A0)₁₆')} (שלוש ספרות).`,
        answer: 'D60', compute: () => complementR('2A0', 16),
        feedbackWrong: `קודם המשלים ל-15: כל ספרה הופכת ל-${ltr('F − d')}. אחר כך מוסיפים 1, ושימו לב ש-F ועוד 1 נותן 0 עם נשא בבסיס 16.`,
      },
      {
        id: 'sub-rule', kind: 'explain',
        text: `חיסור בשיטת המשלים ל-r: מחברים ל-A את המשלים ל-r של B. אם יצא נשא מהספרה העליונה, זורקים אותו והסכום הוא ${ltr('A − B')}. אם לא יצא נשא, התוצאה שלילית, וגודלה הוא המשלים ל-r של הסכום. הסיבה: ${ltr('A + (r^n − B) = r^n + (A − B)')}.`,
      },
      widgetStep({
        id: 'sub-pos', widget: 'ComplementLab', config: { base: 10, digits: 2, value: '73', other: '29', mode: 'subtract' },
        prompt: `חשבו ${ltr('73 − 29')} בלי לחסר. עברו את כל השלבים ושימו לב מה קורה לנשא הסופי.`,
        goal: { phase: 'result' }, example: { phase: 'result' },
      }),
      widgetStep({
        id: 'sub-neg', widget: 'ComplementLab', config: { base: 2, digits: 5, value: '01101', other: '10010', mode: 'subtract' },
        prompt: 'הפעם המחוסר קטן מהמחסר (13 פחות 18). מה קורה לנשא הסופי, ומה סימן התוצאה?',
        goal: { phase: 'result' }, example: { phase: 'result' },
      }),
      {
        id: 'carry-meaning', kind: 'check',
        prompt: `בחיסור ${ltr('A − B')} בשיטת המשלים ל-r יצא נשא מהספרה העליונה. מה זה אומר?`,
        options: [
          `${ltr('A < B')}, והתוצאה שלילית`,
          'החישוב שגוי וצריך להתחיל מחדש',
          `${ltr('A ≥ B')}: זורקים את הנשא והתוצאה חיובית`,
          'מוסיפים את הנשא לספרה הימנית של הסכום',
        ],
        correct: 2,
        feedback: [
          `זה הפוך. נשא סופי נוצר כש-${ltr('A + (r^n − B) ≥ r^n')}, כלומר כש-${ltr('A ≥ B')}. כשאין נשא התוצאה שלילית.`,
          `נשא סופי הוא חלק רגיל מהשיטה ולא שגיאה: הוא ה-${ltr('r^n')} העודף שנוסף כשחיברנו את המשלים.`,
          `נכון: הנשא הוא ה-${ltr('r^n')} העודף, והוא מעיד ש-${ltr('A ≥ B')}.`,
          `זה הכלל של המשלים ל-${ltr('(r−1)')}, שבו הנשא חוזר לספרה הימנית. במשלים ל-r פשוט זורקים את הנשא.`,
        ],
      },
      {
        id: 'six-bit', kind: 'check-number',
        prompt: `חשבו ${ltr('110010 − 011101')} בשיטת המשלים ל-2 על 6 ביטים, וכתבו את התוצאה ב-6 ביטים.`,
        answer: '010101',
        compute: () => toBase((fromBase('110010', 2) + fromBase(complementR('011101', 2), 2)) % 64, 2).padStart(6, '0'),
        feedbackWrong: `מצאו את המשלים ל-2 של ${ltr('011101')} (הפכו והוסיפו 1), חברו אותו ל-${ltr('110010')} וזרקו את הנשא הסופי. כתבו 6 ביטים, כולל אפסים מובילים.`,
      },
      {
        id: 'r1-sub', kind: 'explain',
        text: `אפשר לחסר גם עם המשלים ל-${ltr('(r−1)')}, שחוסך את הוספת ה-1, אבל הוא קטן ב-1 מהמשלים ל-r. לכן כשיוצא נשא סופי, מוסיפים אותו לספרה הימנית של הסכום: ${ltr('73 + 70')} (המשלים ל-9 של 29) ${ltr('= 143')}, ו-${ltr('43 + 1 = 44')}. כשאין נשא, התוצאה שלילית, וגודלה הוא המשלים ל-${ltr('(r−1)')} של הסכום.`,
      },
      {
        id: 'end-around', kind: 'check',
        prompt: `בחיסור בשיטת המשלים ל-${ltr('(r−1)')} (למשל המשלים ל-1 בבינארי) יצא נשא סופי. מה עושים בו?`,
        options: [
          'זורקים אותו, כמו במשלים ל-r',
          'מוסיפים אותו לספרה הימנית של הסכום',
          'מכפילים בו את התוצאה',
          'משאירים אותו כספרה נוספת משמאל',
        ],
        correct: 1,
        feedback: [
          `זה הכלל של המשלים ל-r. המשלים ל-${ltr('(r−1)')} קטן ממנו ב-1, ולכן הנשא הסופי לא נזרק אלא חוזר פנימה.`,
          `נכון: זה ה-end-around carry. הוא משלים את ה-1 שחסר במשלים ל-${ltr('(r−1)')}.`,
          'אין כפל בשיטה הזו: הנשא הוא רק ספרה 1 שמתווספת לסכום.',
          'ההפרש מיוצג על n ספרות. ספרה נוספת משמאל תיתן תוצאה ארוכה מדי ושגויה.',
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `המשלים ל-${ltr('(r−1)')}: כל ספרה d הופכת ל-${ltr('(r−1) − d')}. המשלים ל-r: אותו משלים ועוד 1.`,
          'המשלים נקבע על רוחב קבוע, ואפסים מובילים נספרים כספרות.',
          `${ltr('A − B')} מחושב כ-A ועוד המשלים ל-r של B. נשא סופי: זורקים, והתוצאה חיובית. בלי נשא: התוצאה שלילית, וגודלה המשלים ל-r של הסכום.`,
          `במשלים ל-${ltr('(r−1)')} הנשא הסופי חוזר ומתווסף לספרה הימנית.`,
        ],
      },
    ],
    skipQuiz: [
      { id: 'q1', prompt: `מהו המשלים ל-9 של ${ltr('4057')}?`, options: ['5943', '5942', '4057', '5952'], correct: 1 },
      { id: 'q2', prompt: `מהו המשלים ל-10 של ${ltr('4057')}?`, options: ['5942', '5952', '5943', '6943'], correct: 2 },
      { id: 'q3', prompt: `מהו המשלים ל-2 של ${ltr('0110')} (ארבעה ביטים)?`, options: ['1001', '1010', '1110', '0110'], correct: 1 },
      { id: 'q4', prompt: `מהו המשלים ל-1 של ${ltr('10110')}?`, options: ['01010', '01001', '10110', '11001'], correct: 1 },
      { id: 'q5', prompt: `בחיסור בשיטת המשלים ל-r יצא נשא סופי. מה עושים בו, ומה סימן התוצאה?`, options: ['מוסיפים אותו לספרה הימנית, והתוצאה שלילית', 'משאירים אותו, והתוצאה שלילית', 'זורקים אותו, והתוצאה חיובית', 'זורקים אותו, והתוצאה שלילית'], correct: 2 },
      { id: 'q6', prompt: 'בחיסור בשיטת המשלים ל-r לא יצא נשא סופי. מה זה אומר?', options: ['המחוסר קטן מהמחסר, והתוצאה שלילית', 'המחוסר גדול מהמחסר', 'התוצאה אפס', 'החישוב שגוי'], correct: 0 },
      { id: 'q7', prompt: `חשבו ${ltr('83 − 27')} בשיטת המשלים ל-10 על שתי ספרות. מה התוצאה?`, options: ['156', '46', '110', '56'], correct: 3 },
      { id: 'q8', prompt: `מה ההבדל בין המשלים ל-r למשלים ל-${ltr('(r−1)')}?`, options: ['המשלים ל-r גדול ב-1', 'המשלים ל-r קטן ב-1', 'הם שווים תמיד', `המשלים ל-r הוא ההיפוך של המשלים ל-${ltr('(r−1)')}`], correct: 0 },
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
  's1-weights': `<svg viewBox="0 0 300 130" role="img" aria-label="1011 בבסיס 2: משקלים 8, 4, 2, 1, וסכום 11" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <text x="48" y="20" font-size="15" fill="var(--amber)">8</text>
    <text x="116" y="20" font-size="15" fill="var(--amber)">4</text>
    <text x="184" y="20" font-size="15" fill="var(--amber)">2</text>
    <text x="252" y="20" font-size="15" fill="var(--amber)">1</text>
    <rect x="20" y="30" width="56" height="48" rx="10" fill="none" stroke="var(--one)" stroke-width="2"/>
    <rect x="88" y="30" width="56" height="48" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <rect x="156" y="30" width="56" height="48" rx="10" fill="none" stroke="var(--one)" stroke-width="2"/>
    <rect x="224" y="30" width="56" height="48" rx="10" fill="none" stroke="var(--one)" stroke-width="2"/>
    <text x="48" y="64" font-size="28" font-weight="700" fill="var(--one)">1</text>
    <text x="116" y="64" font-size="28" font-weight="700" fill="var(--zero)">0</text>
    <text x="184" y="64" font-size="28" font-weight="700" fill="var(--one)">1</text>
    <text x="252" y="64" font-size="28" font-weight="700" fill="var(--one)">1</text>
    <text x="150" y="112" font-size="16" fill="var(--muted)">8 + 0 + 2 + 1 = 11</text>
  </g>
</svg>`,
  's1-groups': `<svg viewBox="0 0 300 130" role="img" aria-label="1101111011 מקובץ לרביעיות מימין: 0011, 0111, 1011, כלומר 37B" xmlns="http://www.w3.org/2000/svg">
  <g font-family="var(--font-mono)" text-anchor="middle">
    <rect x="12" y="10" width="88" height="40" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <rect x="106" y="10" width="88" height="40" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <rect x="200" y="10" width="88" height="40" rx="10" fill="none" stroke="var(--border)" stroke-width="2"/>
    <text x="56" y="38" font-size="22" font-weight="700" fill="var(--text)"><tspan fill="var(--zero)">00</tspan>11</text>
    <text x="150" y="38" font-size="22" font-weight="700" fill="var(--text)">0111</text>
    <text x="244" y="38" font-size="22" font-weight="700" fill="var(--text)">1011</text>
    <text x="56" y="76" font-size="18" fill="var(--amber)">↓</text>
    <text x="150" y="76" font-size="18" fill="var(--amber)">↓</text>
    <text x="244" y="76" font-size="18" fill="var(--amber)">↓</text>
    <text x="56" y="108" font-size="28" font-weight="700" fill="var(--one)">3</text>
    <text x="150" y="108" font-size="28" font-weight="700" fill="var(--one)">7</text>
    <text x="244" y="108" font-size="28" font-weight="700" fill="var(--one)">B</text>
  </g>
</svg>`,
}
