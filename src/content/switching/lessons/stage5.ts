import type { Out } from '../../../logic/boolean'
import type { Circuit } from '../../../logic/circuit'
import { arrivalTimes } from '../../../logic/circuit'
import { romBits } from '../../../logic/sizing'
import { referenceChips } from '../../chips'
import type { Figures, Lesson } from '../../lessons/types'
import { widgetStep } from '../../lessons/widgetTypes'
import { node as n, wire as w, ltr } from '../helpers'
import { adderSubtractor } from '../stage5'
import { syl } from '../syllabus'
import { switchingWorld } from '../world'

const STAGE = 'sw-5-blocks'

/** Half adder from XOR and AND: S = A xor B, C = A and B. Outputs in alphabetical order: C, S. */
const halfAdder: Circuit = {
  nodes: [n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('g1', 'XOR'), n('g2', 'AND'), n('C', 'OUT', 'C'), n('S', 'OUT', 'S')],
  wires: [w('A', 'g1', 0), w('B', 'g1', 1), w('A', 'g2', 0), w('B', 'g2', 1), w('g1', 'S'), w('g2', 'C')],
}
const HA_ROWS: Out[][] = [[0, 0], [0, 1], [0, 1], [1, 0]] // columns: C, S; rows: AB = 00, 01, 10, 11

/**
 * Full adder from 5 gates of {AND, OR, XOR}: x = A xor B, S = x xor Cin, Cout = A·B + x·Cin
 * (two half adders and an OR). Outputs in alphabetical order: Cout, S.
 */
const fullAdder: Circuit = {
  nodes: [
    n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('Cin', 'IN', 'Cin'),
    n('x', 'XOR'), n('s', 'XOR'), n('a1', 'AND'), n('a2', 'AND'), n('co', 'OR'),
    n('Cout', 'OUT', 'Cout'), n('S', 'OUT', 'S'),
  ],
  wires: [
    w('A', 'x', 0), w('B', 'x', 1), w('x', 's', 0), w('Cin', 's', 1),
    w('A', 'a1', 0), w('B', 'a1', 1), w('x', 'a2', 0), w('Cin', 'a2', 1),
    w('a1', 'co', 0), w('a2', 'co', 1), w('co', 'Cout'), w('s', 'S'),
  ],
}
const FA_ROWS: Out[][] = [[0, 0], [0, 1], [0, 1], [1, 0], [0, 1], [1, 0], [1, 0], [1, 1]] // columns: Cout, S; rows: A B Cin = 000 … 111

const chips = () => referenceChips(switchingWorld)
/** Worst-case arrival time at V of the course's adder/subtractor (FA 100 ns, XOR 75 ns, M ideal), via the circuit engine. */
const vArrival = (bits: number) => arrivalTimes(adderSubtractor(bits), chips()).V

const l1: Lesson = {
  id: 'sw-5-l1', stage: STAGE, order: 1,
  title: 'מחברים ומחסרים', minutes: 12,
  blurb: 'מחצי מחבר ועד מחבר/מחסר: איך הנשא מתגלגל, וכמה זמן זה לוקח.',
  source: syl(6),
  steps: [
    {
      id: 'column', kind: 'explain', figure: 's5-column',
      text: `תזכורת משיעור 2.1: מחברים בינארי עמודה אחרי עמודה, כמו בכתב. ארבעת המקרים הם ${ltr('0 + 0 = 0')}, ${ltr('0 + 1 = 1')}, ${ltr('1 + 0 = 1')} ו-${ltr('1 + 1 = 10')}: כותבים 0 ונושאים ${ltr('(Carry)')} 1 לעמודה שמשמאל. כאן נראה את אותו חיבור כמעגל.`,
    },
    {
      id: 'one-one', kind: 'check',
      prompt: `מחברים שני ביטים בעמודה אחת: ${ltr('1 + 1')}. מה כותבים ומה נושאים?`,
      options: ['כותבים 2 ואין נשא', 'כותבים 0 ונושאים 1', 'כותבים 1 ונושאים 1', 'כותבים 0 ואין נשא'],
      correct: 1,
      feedback: [
        'בבסיס 2 אין ספרה 2. כשהסכום מגיע לגודל הבסיס, כמו בעשרוני כשהסכום מגיע לעשר, כותבים 0 ונושאים 1.',
        `נכון: ${ltr('1 + 1 = 2')}, ובבסיס 2 זה נכתב ${ltr('10')}. הספרה 0 נשארת בעמודה, והספרה 1 עוברת הלאה כנשא.`,
        `זה היה נותן ${ltr('11')}, כלומר 3. הסכום של שני ביטים הוא 2, לא 3.`,
        'אז הערך 2 היה נעלם: העמודה הבאה לא הייתה מקבלת את ה-1. הנשא הוא מה ששומר על הערך.',
      ],
    },
    {
      id: 'ha', kind: 'explain', figure: 's5-ha',
      text: `חצי מחבר ${ltr('(Half Adder)')} מחבר שני ביטים, A ו-B, ומוציא שני ביטים: סכום S ונשא C. הסכום הוא 1 כשהכניסות שונות זו מזו, ולכן ${ltr('S = A ⊕ B')}. הנשא הוא 1 רק כששתיהן 1, ולכן ${ltr('C = A · B')}.`,
    },
    {
      id: 'build-ha', kind: 'try',
      prompt: 'בנו חצי מחבר מהשערים AND ו-XOR. הכניסות הן A ו-B, והיציאות הן C (נשא) ו-S (סכום).',
      puzzle: {
        type: 'circuit', spec: { inputs: ['A', 'B'], outputs: ['C', 'S'], rows: HA_ROWS },
        allowed: ['AND', 'XOR'], optimalGates: 2, reference: halfAdder,
      },
      hints: [
        { text: 'הסכום S הוא 1 כשהכניסות שונות. איזה שער מוציא 1 רק כשהכניסות שונות?' },
        { text: `${ltr('S = A ⊕ B')} ו-${ltr('C = A · B')}: שער XOR ושער AND, ושניהם מקבלים את A ואת B.` },
      ],
    },
    {
      id: 'fa', kind: 'explain', figure: 's5-fa',
      text: `במחבר מלא ${ltr('(Full Adder)')} יש שלוש כניסות: A, B ונשא נכנס ${ltr('Cin')} מהעמודה הקודמת. הסכום הוא 1 כשמספר ה-1 בכניסות אי-זוגי, והנשא היוצא ${ltr('Cout')} הוא 1 כשלפחות שתיים מהן 1. אפשר לבנות אותו משני חצאי מחבר ושער OR.`,
    },
    {
      id: 'fa-111', kind: 'check',
      prompt: `במחבר מלא כל שלוש הכניסות הן 1: ${ltr('A = B = Cin = 1')}. מה היציאות?`,
      options: [ltr('S = 0, Cout = 1'), ltr('S = 1, Cout = 1'), ltr('S = 1, Cout = 0'), ltr('S = 0, Cout = 0')],
      correct: 1,
      feedback: [
        `זו התוצאה של שני 1 בלבד: ${ltr('1 + 1 = 10')}. כאן יש גם נשא נכנס, ולכן הסכום הכולל הוא 3.`,
        `נכון: ${ltr('1 + 1 + 1 = 3')}, ובבינארי ${ltr('3 = 11')}. הספרה הימנית 1 היא S, והספרה השמאלית 1 היא Cout.`,
        `הסכום 3 לא נכנס בביט אחד. הוא דורש שני ביטים, ${ltr('11')}, ולכן גם Cout הוא 1.`,
        'זה הסכום של שלושה אפסים. כאן שלוש הכניסות הן 1, והסכום הוא 3.',
      ],
    },
    {
      id: 'build-fa', kind: 'try',
      prompt: 'בנו מחבר מלא מהשערים AND, OR ו-XOR. הכניסות הן A, B ו-Cin, והיציאות הן Cout ו-S.',
      puzzle: {
        type: 'circuit', spec: { inputs: ['A', 'B', 'Cin'], outputs: ['Cout', 'S'], rows: FA_ROWS },
        allowed: ['AND', 'OR', 'XOR'], optimalGates: 5, reference: fullAdder,
      },
      hints: [
        { text: `בנו קודם חצי מחבר על A ו-B: ${ltr('S₁ = A ⊕ B')} ו-${ltr('C₁ = A · B')}.` },
        { text: `חצי מחבר שני מחבר את S₁ עם Cin: הסכום הסופי הוא ${ltr('S = S₁ ⊕ Cin')}, והנשא שלו הוא ${ltr('C₂ = S₁ · Cin')}.` },
        { text: `הנשא היוצא הוא ${ltr('Cout = C₁ + C₂')}: שער OR אחד. בסך הכול 5 שערים.` },
      ],
    },
    {
      id: 'ripple', kind: 'explain',
      text: `כדי לחבר מספרים של 4 ביטים שרשרו ארבעה מחברים מלאים: הנשא היוצא של כל שלב נכנס לשלב הבא. זה מחבר אדווה ${ltr('(Ripple Carry)')}. שלב לא יכול לסיים לפני שהנשא של קודמו הגיע, ולכן הנשא מתגלגל משלב לשלב וההשהיות מצטברות.`,
    },
    widgetStep({
      id: 'ripple-plain', widget: 'RippleTimeline',
      prompt: 'הפעילו את הציר או גררו אותו: כל מחבר מלא לוקח 100 ns. עקבו אחרי הנשא, וגררו עד שכל הביטים יציבים.',
      config: { a: '0111', b: '0001', delays: { fa: 100 } },
      goal: { kind: 'settled' }, example: { t: 400 },
    }),
    {
      id: 'sub', kind: 'explain',
      text: `כדי לחסר משתמשים באותו מחבר: ${ltr("A − B = A + B' + 1")}, כלומר מחברים את A עם B ההפוך ועוד 1. לכל ביט של B מוסיפים שער XOR עם קו בקרה M, ו-M נכנס גם כנשא ההתחלתי. כש-${ltr('M = 0')} המעגל מחבר, וכש-${ltr('M = 1')} הוא מחסר.`,
    },
    widgetStep({
      id: 'sub-timeline', widget: 'RippleTimeline',
      prompt: `זה מחסר של 4 ביטים: ${ltr('5 − 3')}. כל XOR לוקח 75 ns וכל מחבר מלא 100 ns. גררו עד שכל היציאות יציבות, כולל V, שמזהה גלישה במספרים עם סימן ${ltr('(V = C₄ ⊕ C₃)')}. כאן ${ltr('C₄')} הוא Cout, ו-${ltr('C₃')} הוא הנשא שנכנס לביט 3. שימו לב מי מוכן אחרון.`,
      config: { a: '0101', b: '0011', delays: { fa: 100, xor: 75 }, m: 1, overflow: true },
      goal: { kind: 'settled' }, example: { t: 550 },
    }),
    {
      id: 'why-plus-one', kind: 'check',
      prompt: `במחסר שבנוי ממחבר, כש-${ltr('M = 1')} מכניסים 1 כנשא הראשון. למה?`,
      options: [
        'כדי שה-XOR לא יאט את המעגל',
        'כדי לזהות גלישה',
        `היפוך B נותן משלים ל-1, ועוד 1 נותן משלים ל-2, שהוא ${ltr('−B')}`,
        'כי XOR עם 1 מוסיף 1 לכל ביט של B',
      ],
      correct: 2,
      feedback: [
        'הנשא הראשון לא קשור לזמן. התפקיד שלו חשבוני: הוא משלים את ההיפוך של B למשלים ל-2, וזה מה שנדרש לחיסור.',
        'גלישה מזוהה בעזרת V, ה-XOR של שני הנשאים האחרונים. הנשא הראשון לא משתתף בזיהוי.',
        `נכון: ${ltr("B'")} הוא משלים ל-1, והנשא הראשון מוסיף 1. ${ltr("A + B' + 1")} הוא A ועוד משלים ל-2 של B, כלומר ${ltr('A − B')}.`,
        'XOR עם 1 הופך ביט (0 ל-1 ו-1 ל-0), הוא לא מוסיף. ההוספה של 1 נעשית פעם אחת בלבד, דרך הנשא הראשון.',
      ],
    },
    {
      id: 'v-time', kind: 'check-number',
      prompt: `מחבר/מחסר של 5 ביטים: ${ltr('XOR = 75 ns')}, ${ltr('FA = 100 ns')}, ו-M כניסה אידיאלית. אחרי כמה ns הגלישה V יציבה, במקרה הגרוע?`,
      answer: '650', compute: () => String(vArrival(5)),
      feedbackWrong: 'עקבו אחרי המסלול הארוך ביותר: XOR על B, כל המחברים בשרשרת, ואז ה-XOR האחרון שיוצר את V. סכמו את ההשהיות לאורכו.',
    },
    {
      id: 'recap', kind: 'recap',
      points: [
        `חצי מחבר: ${ltr('S = A ⊕ B')} ו-${ltr('C = A · B')}. מחבר מלא מוסיף נשא נכנס ${ltr('Cin')}.`,
        'מחבר אדווה הוא שרשרת של מחברים מלאים, והנשא מתגלגל משלב לשלב.',
        'ההשהיה הגרועה גדלה עם מספר הביטים, כי כל שלב ממתין לנשא של קודמו.',
        `מחסר: ${ltr("A − B = A + B' + 1")}. XOR על B, ו-M כנשא ראשון. גלישה: ${ltr('V = C(n) ⊕ C(n−1)')}.`,
      ],
    },
  ],
  skipQuiz: [
    { id: 'q1', prompt: 'מהי פונקציית הנשא C בחצי מחבר?', options: [ltr('A ⊕ B'), ltr('A · B'), ltr('A + B'), ltr("A' · B'")], correct: 1 },
    { id: 'q2', prompt: `במחבר מלא ${ltr('A = 1, B = 0, Cin = 1')}. מה היציאות?`, options: [ltr('S = 1, Cout = 0'), ltr('S = 1, Cout = 1'), ltr('S = 0, Cout = 1'), ltr('S = 0, Cout = 0')], correct: 2 },
    { id: 'q3', prompt: 'במחבר אדווה של 6 ביטים כל FA לוקח 100 ns. אחרי כמה זמן הנשא היוצא יציב, במקרה הגרוע?', options: ['100 ns', '300 ns', '600 ns', '700 ns'], correct: 2 },
    {
      id: 'q4', prompt: 'מה עושה קו הבקרה M במחבר/מחסר?',
      options: [
        `כש-${ltr('M = 1')} הוא הופך את B ומכניס 1 כנשא ראשון, ולכן המעגל מחסר`,
        'הוא מכפיל את A ב-2',
        'הוא מאפס את הנשא היוצא',
        'הוא בוחר איזה מחבר מלא יפעל',
      ],
      correct: 0,
    },
    { id: 'q5', prompt: 'איזה שער נותן את הסכום של חצי מחבר?', options: ['AND', 'OR', 'XOR', 'NAND'], correct: 2 },
    {
      id: 'q6', prompt: 'למה מחבר אדווה איטי יחסית?',
      options: ['כל שלב ממתין לנשא של השלב שלפניו', 'כי הוא בנוי מחצאי מחבר בלבד', 'כי שער XOR איטי מכל שער אחר', 'כי הוא מחשב כל ביט פעמיים'],
      correct: 0,
    },
    {
      id: 'q7', prompt: `מה מזהה ${ltr('V = C(n) ⊕ C(n−1)')} במחבר/מחסר?`,
      options: ['שהתוצאה אפס', 'גלישה במספרים עם סימן', 'ש-A גדול מ-B', 'שמספר ה-1 בתוצאה זוגי'],
      correct: 1,
    },
  ],
}

const l2: Lesson = {
  id: 'sw-5-l2', stage: STAGE, order: 2,
  title: 'MUX ומפענחים', minutes: 11,
  blurb: 'מרבב שבוחר כניסה, מרבב שהוא טבלת אמת, ומפענח שמדליק מינטרם אחד.',
  source: syl(4),
  steps: [
    {
      id: 'what', kind: 'explain',
      text: `מרבב ${ltr('(MUX)')} הוא בורר: כמה כניסות נתונים נכנסות אליו, וקווי הבחירה קובעים איזו מהן תגיע ליציאה Y. עם n קווי בחירה יש ${ltr('2^n')} כניסות נתונים. למשל ${ltr('MUX 4×1')} הוא מרבב עם ארבע כניסות נתונים, ${ltr('D0…D3')}, ושני קווי בחירה.`,
    },
    widgetStep({
      id: 'route', widget: 'MuxToy',
      prompt: `הפכו את קווי הבחירה ${ltr('S1')} ו-${ltr('S0')} וראו איזו כניסה מגיעה ל-Y. הביאו את D2 ליציאה.`,
      config: { selectBits: 2, mode: 'route', inputs: [0, 1, 1, 0], selectNames: ['S1', 'S0'] },
      goal: { kind: 'route', input: 2 }, example: { select: [1, 0], inputs: [0, 1, 1, 0] },
    }),
    {
      id: 'which', kind: 'check',
      prompt: `במרבב ${ltr('4×1')} מתקיים ${ltr('S1 = 1')} ו-${ltr('S0 = 0')}. איזו כניסה מגיעה ליציאה?`,
      options: ['D0', 'D1', 'D2', 'D3'],
      correct: 2,
      feedback: [
        `D0 נבחרת כששני קווי הבחירה הם 0. כאן ${ltr('S1 = 1')}.`,
        `D1 שייכת לצירוף ${ltr('S1S0 = 01')}. כאן הצירוף הפוך: S1 הוא הספרה השמאלית, ולכן הצירוף הוא ${ltr('10')}.`,
        `נכון: ${ltr('S1S0 = 10')} הוא המספר 2 בבינארי, ולכן D2 מגיעה ליציאה.`,
        'D3 נבחרת כששני קווי הבחירה הם 1. כאן S0 הוא 0.',
      ],
    },
    {
      id: 'table', kind: 'explain',
      text: `אם מחברים 0 או 1 לכל כניסת נתונים, המרבב נעשה טבלת אמת בחומרה: קווי הבחירה הם משתני הפונקציה, ו-${ltr('D_i')} הוא ערך הפונקציה בשורה i. כך אפשר לממש כל פונקציה של n משתנים במרבב עם ${ltr('2^n')} כניסות נתונים.`,
    },
    widgetStep({
      id: 'xor', widget: 'MuxToy',
      prompt: `ממשו ${ltr('F = A ⊕ B')}. הפונקציה היא 1 בשורות ${ltr('01')} ו-${ltr('10')} בלבד. קבעו את ${ltr('D0…D3')} כך שהמרבב יממש אותה.`,
      config: { selectBits: 2, mode: 'function', selectNames: ['A', 'B'] },
      goal: { kind: 'implements', minterms: [1, 2] }, example: { select: [0, 0], inputs: [0, 1, 1, 0] },
    }),
    {
      id: 'and', kind: 'check',
      prompt: `איך מחברים את ${ltr('D0…D3')}, לפי הסדר, כדי שהמרבב יממש ${ltr('F = A · B')}? A הוא קו הבחירה השמאלי.`,
      options: [ltr('1 0 0 0'), ltr('0 0 0 1'), ltr('0 1 1 1'), ltr('0 1 1 0')],
      correct: 1,
      feedback: [
        `במקרה כזה Y הוא 1 רק כש-${ltr('AB = 00')}. זו הפונקציה NOR, לא AND.`,
        `נכון: AND הוא 1 רק בשורה ${ltr('AB = 11')}, ולכן רק D3 מחוברת ל-1.`,
        `במקרה כזה Y הוא 1 בכל שורה חוץ מ-${ltr('AB = 00')}. זו הפונקציה OR.`,
        'במקרה כזה Y הוא 1 כשהכניסות שונות זו מזו. זו הפונקציה XOR.',
      ],
    },
    {
      id: 'trick', kind: 'explain',
      text: `מרבב עם n קווי בחירה מממש גם פונקציה של ${ltr('n + 1')} משתנים: המשתנה האחרון, C, נכנס לכניסות הנתונים. בכל שורה של הבחירה מסתכלים על שתי שורות הטבלה, ${ltr('C = 0')} ו-${ltr('C = 1')}: אם F שווה 0 בשתיהן מחברים 0, אם 1 בשתיהן מחברים 1, אם F שווה C מחברים C, ואם F שווה ${ltr("C'")} מחברים ${ltr("C'")}.`,
    },
    widgetStep({
      id: 'majority', widget: 'MuxToy',
      prompt: `פונקציית הרוב ${ltr('F(A,B,C) = Σm(3, 5, 6, 7)')} היא 1 כשלפחות שניים מהמשתנים 1. A ו-B בקווי הבחירה. לחצו על כל כניסה כדי להחליף בין ${ltr("0, 1, C, C'")}, והתאימו אותה לשתי העמודות בטבלה.`,
      config: { selectBits: 2, mode: 'function', extra: 'C', selectNames: ['A', 'B'] },
      goal: { kind: 'implements-x', minterms: [3, 5, 6, 7] },
      example: { select: [0, 0], inputs: [0, 0, 0, 1], data: [0, 'x', 'x', 1], x: 0 },
    }),
    {
      id: 'wiring', kind: 'check',
      prompt: `${ltr('F(A,B,C) = Σm(1, 3, 4, 6)')}, ו-A ו-B בקווי הבחירה של ${ltr('MUX 4×1')}. מה מחברים לכניסות ${ltr('D0…D3')}?`,
      options: [ltr("C', C', C, C"), ltr("C, C', C, C'"), ltr('0, 0, 1, 1'), ltr("C, C, C', C'")],
      correct: 3,
      feedback: [
        `החלפתם בין C ל-${ltr("C'")}. בשורה ${ltr('AB = 00')} הפונקציה היא 1 כש-${ltr('C = 1')} (מינטרם 1), ולכן D0 צריכה להיות C.`,
        `בשורה ${ltr('AB = 01')} הפונקציה היא 0 כש-${ltr('C = 0')} ו-1 כש-${ltr('C = 1')}, כלומר C. לכן D1 היא C ולא ${ltr("C'")}.`,
        'זה נכון רק אם הפונקציה לא תלויה ב-C. אבל בכל שורה של הבחירה הפונקציה משתנה כש-C משתנה.',
        `נכון: ${ltr('AB = 00')} ו-${ltr('AB = 01')} נותנים 0 ואז 1, כלומר C. ${ltr('AB = 10')} ו-${ltr('AB = 11')} נותנים 1 ואז 0, כלומר ${ltr("C'")}.`,
      ],
    },
    {
      id: 'count', kind: 'check-number',
      prompt: 'רוצים לממש פונקציה של 5 משתנים במרבב, כשמשתנה אחד נכנס לכניסות הנתונים. כמה כניסות נתונים יש למרבב?',
      answer: '16', compute: () => String(1 << (5 - 1)),
      feedbackWrong: 'משתנה אחד נכנס לכניסות הנתונים, והארבעה האחרים הם קווי הבחירה. כמה כניסות נתונים יש לארבעה קווי בחירה?',
    },
    {
      id: 'decoder', kind: 'explain', figure: 's5-decoder',
      text: `מפענח ${ltr('(Decoder)')} הופך צירוף כניסות ליציאה אחת דולקת: n כניסות, ${ltr('2^n')} יציאות, ובדיוק יציאה אחת פעילה: זו של הצירוף הנוכחי. כל יציאה היא מינטרם של הכניסות. לכן אפשר לממש פונקציה כ-OR של היציאות שבהן היא 1: ${ltr('F = Σm')}.`,
    },
    {
      id: 'decoder-or', kind: 'check',
      prompt: `מממשים ${ltr('F(A,B,C) = Σm(2, 3, 7)')} בעזרת מפענח 3-ל-8 ושער OR. לאילו יציאות מחברים את שער ה-OR?`,
      options: [ltr('Y2, Y3, Y7'), ltr('Y0, Y1, Y4, Y5, Y6'), ltr('Y1, Y2, Y6'), ltr('Y2, Y6, Y7')],
      correct: 0,
      feedback: [
        `נכון: כל יציאה ${ltr('Yi')} היא המינטרם ${ltr('mi')}, ו-OR של Y2, Y3 ו-Y7 נותן בדיוק ${ltr('Σm(2, 3, 7)')}.`,
        `אלה היציאות שבהן F שווה 0, כלומר המינטרמים של ${ltr("F'")}. OR שלהן נותן את ${ltr("F'")}, לא את F.`,
        'המינטרמים ממוספרים מ-0: הצירוף 000 הוא m0. מספרתם מ-1, ולכן הזזתם את כולם באחד.',
        `קראתם את הביטים הפוך, עם C ראשון. הצירוף ${ltr('ABC = 011')} הוא מינטרם 3 ומפעיל את Y3, לא את Y6.`,
      ],
    },
    {
      id: 'recap', kind: 'recap',
      points: [
        `מרבב ${ltr('2^n × 1')}: n קווי בחירה, כקלט בינארי, בוחרים אחת מ-${ltr('2^n')} כניסות נתונים.`,
        `כשמחברים 0 או 1 לכניסות, המרבב הוא טבלת אמת: ${ltr('D_i')} הוא ערך F בשורה i.`,
        `מרבב עם n קווי בחירה מממש פונקציה של ${ltr('n + 1')} משתנים: המשתנה האחרון, משלימו, 0 או 1 נכנסים לכניסות.`,
        `מפענח n-ל-${ltr('2^n')} מפעיל יציאה אחת, המינטרם של הקלט. OR של מינטרמים נותן ${ltr('F = Σm')}.`,
      ],
    },
  ],
  skipQuiz: [
    { id: 'q1', prompt: `כמה קווי בחירה יש במרבב ${ltr('8×1')}?`, options: ['2', '3', '4', '8'], correct: 1 },
    { id: 'q2', prompt: `במרבב ${ltr('4×1')} מתקיים ${ltr('S1S0 = 01')}. איזו כניסה מגיעה ליציאה?`, options: ['D0', 'D1', 'D2', 'D3'], correct: 1 },
    {
      id: 'q3', prompt: `במרבב ${ltr('4×1')} ש-A הוא קו הבחירה השמאלי שלו, מחברים ${ltr('D0…D3')} כך: ${ltr('0 1 1 0')}. איזו פונקציה הוא מממש?`,
      options: ['AND', 'OR', 'NAND', 'XOR'], correct: 3,
    },
    { id: 'q4', prompt: 'כמה יציאות פעילות בו-זמנית יש במפענח 3-ל-8?', options: ['0', '1', '3', '8'], correct: 1 },
    { id: 'q5', prompt: 'רוצים לממש פונקציה של 4 משתנים במרבב, כשמשתנה אחד נכנס לכניסות הנתונים. כמה קווי בחירה נדרשים?', options: ['2', '3', '4', '8'], correct: 1 },
    {
      id: 'q6', prompt: `בשורה של הבחירה הפונקציה F שווה 0 כש-${ltr('C = 0')} ושווה 1 כש-${ltr('C = 1')}. מה מחברים לכניסת הנתונים של השורה?`,
      options: ['0', '1', 'C', ltr("C'")], correct: 2,
    },
    {
      id: 'q7', prompt: `מממשים ${ltr('F(A,B,C) = Σm(1, 4)')} בעזרת מפענח 3-ל-8 ושער OR. לאילו יציאות מחברים את ה-OR?`,
      options: [ltr('Y2, Y5'), ltr('Y0, Y3'), ltr('Y1, Y4'), ltr('Y0, Y2, Y3, Y5, Y6, Y7')], correct: 2,
    },
  ],
}

const l3: Lesson = {
  id: 'sw-5-l3', stage: STAGE, order: 3,
  title: 'ROM ו-PLA', minutes: 9,
  blurb: 'זיכרון שהוא טבלת אמת: כמה ביטים הוא מכיל, ואיך PLA חוסך מקום.',
  source: syl(11),
  steps: [
    {
      id: 'rom', kind: 'explain',
      text: `ROM ${ltr('(Read Only Memory)')} הוא טבלת אמת שמורה בזיכרון: קווי הכתובת הם הכניסות, וכל כתובת מחזיקה מילה, שהיא היציאות. עם n קווי כתובת יש ${ltr('2^n')} מילים, ואם כל מילה היא m ביטים, הזיכרון מכיל ${ltr('2^n × m')} ביטים.`,
    },
    {
      id: 'size', kind: 'check-number',
      prompt: 'ROM עם 4 קווי כתובת ו-8 יציאות. כמה ביטים הוא מכיל?',
      answer: '128', compute: () => String(romBits(4, 8)),
      feedbackWrong: `קודם ספרו את המילים: n קווי כתובת נותנים ${ltr('2^n')} כתובות. אחר כך הכפילו ברוחב המילה.`,
    },
    widgetStep({
      id: 'program', widget: 'MuxToy',
      prompt: `כך מתכנתים ROM. הזיכרון כאן הוא בעל 3 קווי כתובת ויציאה אחת, ונשמור בו את ${ltr('F = Σm(1, 2, 4, 7)')}. לחצו על כל תא כדי לקבוע 0 או 1, כך שבכתובת i יישמר ערך הפונקציה.`,
      config: { selectBits: 3, mode: 'function', skin: 'rom', selectNames: ['A', 'B', 'C'] },
      goal: { kind: 'implements', minterms: [1, 2, 4, 7] }, example: { select: [0, 0, 0], inputs: [0, 1, 1, 0, 1, 0, 0, 1] },
    }),
    {
      id: 'inside', kind: 'explain', figure: 's5-rom',
      text: `בתוך ROM יש שני מישורים. מישור ה-AND הוא מפענח מלא וקבוע: הוא יוצר את כל ${ltr('2^n')} המינטרמים של הכניסות. מישור ה-OR הוא זה שמתכנתים: לכל יציאה בוחרים אילו מינטרמים מחוברים אליה. לכן התוכן שבתאים קובע אילו מינטרמים נכנסים ל-OR.`,
    },
    {
      id: 'fixed', kind: 'check',
      prompt: 'מה קבוע ב-ROM ומה ניתן לתכנות?',
      options: ['שני המישורים מתוכנתים', 'מישור ה-OR קבוע, ומישור ה-AND מתוכנת', 'מישור ה-AND קבוע (מפענח מלא), ומישור ה-OR מתוכנת', 'שני המישורים קבועים'],
      correct: 2,
      feedback: [
        'זה PLA. ב-ROM מישור ה-AND תמיד מייצר את כל המינטרמים, ואי אפשר לבחור איזה מהם ייווצר.',
        'זה ההפך. ב-ROM מישור ה-AND הוא מפענח מלא שאינו משתנה, ואילו תוכן הזיכרון בוחר אילו מינטרמים נכנסים ל-OR.',
        'נכון: מפענח מלא יוצר את כל המינטרמים, והתוכן שבתאים בוחר אילו מהם מגיעים ל-OR של כל יציאה.',
        'אז אי אפשר היה לשמור שום פונקציה. מה שמתכנתים הוא מישור ה-OR.',
      ],
    },
    {
      id: 'pla', kind: 'explain',
      text: `ב-PLA ${ltr('(Programmable Logic Array)')} שני המישורים מתוכנתים. מישור ה-AND מייצר רק את איברי המכפלה שהפונקציות באמת צריכות, ולא את כל ${ltr('2^n')} המינטרמים, ואיבר מכפלה אחד יכול להזין כמה יציאות. לכן PLA משתלם כשיש הרבה כניסות ומעט איברי מכפלה.`,
    },
    {
      id: 'when', kind: 'check',
      prompt: 'לפונקציה יש 8 כניסות, והיא נכתבת בעזרת 3 איברי מכפלה בלבד. למה PLA עדיף כאן על ROM?',
      options: [
        'PLA מהיר פי 256 מ-ROM',
        'ROM חייב להחזיק את כל 256 הצירופים, וב-PLA מממשים רק 3 איברים',
        'ב-ROM אי אפשר לממש פונקציה של 8 כניסות',
        'ב-PLA אין מישור OR',
      ],
      correct: 1,
      feedback: [
        'מספר הצירופים לא קובע מהירות. ההבדל הוא בגודל: מה צריך לממש ולאחסן.',
        `נכון: ל-ROM עם 8 קווי כתובת יש ${ltr('2^8 = 256')} מילים, בלי קשר למספר האיברים. PLA מממש רק את 3 האיברים.`,
        'אפשר: ROM עם 8 קווי כתובת. הבעיה היא המחיר, 256 מילים, ולא היכולת.',
        'יש: ב-PLA שני המישורים קיימים ושניהם מתוכנתים. ההבדל מ-ROM הוא במישור ה-AND.',
      ],
    },
    {
      id: 'shared', kind: 'check-number',
      prompt: `ב-PLA ממומשות שתי פונקציות: ${ltr('F1 = A · B + C')} ו-${ltr('F2 = A · B + D')}. כמה איברי מכפלה (שערי AND) נדרשים במישור ה-AND?`,
      answer: '3',
      compute: () => {
        const f1 = ['AB', 'C'], f2 = ['AB', 'D']
        return String(new Set([...f1, ...f2]).size)
      },
      feedbackWrong: 'איבר מכפלה אחד יכול להזין כמה יציאות. ספרו כל איבר מכפלה שונה פעם אחת, בשתי הפונקציות יחד.',
    },
    {
      id: 'compare', kind: 'check-number',
      prompt: `ROM מקבל שני מספרים בני 4 ביטים ומשווה ביניהם. היציאות הן ${ltr('A > B')}, ${ltr('A = B')} ו-${ltr('A < B')}. כמה ביטים יש ב-ROM?`,
      answer: '768', compute: () => String(romBits(2 * 4, 3)),
      feedbackWrong: 'מספר הכניסות הוא 8 (4 ביטים מכל מספר), ויש 3 יציאות. הכפילו את מספר הכתובות ברוחב המילה.',
    },
    {
      id: 'recap', kind: 'recap',
      points: [
        `ROM הוא טבלת אמת: n קווי כתובת הם הכניסות, m ביטים במילה הם היציאות, והגודל הוא ${ltr('2^n × m')} ביטים.`,
        'ב-ROM מישור ה-AND קבוע (מפענח מלא, כל המינטרמים), ומישור ה-OR מתוכנת.',
        'ב-PLA שני המישורים מתוכנתים, ולכן ממומשים רק איברי המכפלה הדרושים.',
        'PLA משתלם כשיש הרבה כניסות ומעט איברי מכפלה. ROM מתאים לטבלה שרירותית, שאין בה מבנה לפשט.',
      ],
    },
  ],
  skipQuiz: [
    { id: 'q1', prompt: 'ROM עם 5 קווי כתובת ו-3 יציאות. כמה ביטים הוא מכיל?', options: ['15', '32', '96', '256'], correct: 2 },
    { id: 'q2', prompt: 'מה הם קווי הכתובת של ROM שמממש פונקציה?', options: ['היציאות של הפונקציה', 'הכניסות של הפונקציה', 'המינטרמים של הפונקציה', 'קווי הבקרה של הזיכרון'], correct: 1 },
    { id: 'q3', prompt: 'ROM עם 10 קווי כתובת ויציאה אחת. כמה ביטים הוא מכיל?', options: ['10', '100', '1024', '2048'], correct: 2 },
    {
      id: 'q4', prompt: 'מה ההבדל בין ROM ל-PLA?',
      options: ['ב-ROM שני המישורים מתוכנתים', 'ב-ROM מישור ה-AND קבוע, וב-PLA הוא מתוכנת', 'ב-PLA אין מישור OR', 'ב-PLA מישור ה-OR קבוע, ומישור ה-AND מתוכנת'],
      correct: 1,
    },
    { id: 'q5', prompt: 'איזה רכיב מממש רק את איברי המכפלה שהפונקציות צריכות?', options: ['ROM', 'מרבב', 'PLA', 'מפענח'], correct: 2 },
    {
      id: 'q6', prompt: `ב-ROM של 3 קווי כתובת מאוחסנים בכתובות 0 עד 7 הערכים ${ltr('0 1 1 0 1 0 0 1')}. איזו פונקציה הוא מממש?`,
      options: [ltr('Σm(0, 3, 5, 6)'), ltr('Σm(1, 2, 4, 7)'), ltr('Σm(1, 2, 3, 7)'), ltr('Σm(0, 1, 2, 4)')], correct: 1,
    },
    {
      id: 'q7', prompt: 'למה הגודל של ROM גדל מהר כשמוסיפים כניסות?',
      options: ['כל כניסה מכפילה את רוחב המילה', 'מספר המילים הוא 2 בחזקת מספר הכניסות', 'כל כניסה מוסיפה מישור חדש', 'ROM שומר רק את הערכים 0'],
      correct: 1,
    },
  ],
}

export const lessons: Lesson[] = [l1, l2, l3]

const FONT = 'font-family="var(--font-mono)"'
const ARROW = `<defs><marker id="s5a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--amber)"/></marker></defs>`

/** Inline SVG figures for this stage's explain steps, by id (prefixed "s5-"). Colours come from theme tokens. */
export const figures: Figures = {
  's5-column': `<svg viewBox="0 0 300 150" role="img" aria-label="1 + 1 = 10: sum bit 0, carry 1" xmlns="http://www.w3.org/2000/svg">
  ${ARROW}
  <g ${FONT} text-anchor="middle">
    <text x="160" y="22" font-size="20" font-weight="700" fill="var(--amber)">1</text>
    <path d="M200 40 Q182 22 172 20" fill="none" stroke="var(--amber)" stroke-width="2" marker-end="url(#s5a)"/>
    <text x="70" y="64" font-size="14" fill="var(--muted)">A</text>
    <text x="160" y="64" font-size="26" font-weight="700" fill="var(--text)">0</text>
    <text x="200" y="64" font-size="26" font-weight="700" fill="var(--text)">1</text>
    <text x="70" y="98" font-size="14" fill="var(--muted)">B</text>
    <text x="124" y="98" font-size="22" fill="var(--muted)">+</text>
    <text x="160" y="98" font-size="26" font-weight="700" fill="var(--text)">0</text>
    <text x="200" y="98" font-size="26" font-weight="700" fill="var(--text)">1</text>
    <line x1="110" y1="110" x2="226" y2="110" stroke="var(--border)" stroke-width="2"/>
    <text x="70" y="140" font-size="14" fill="var(--muted)">S</text>
    <text x="160" y="140" font-size="26" font-weight="700" fill="var(--one)">1</text>
    <text x="200" y="140" font-size="26" font-weight="700" fill="var(--one)">0</text>
  </g>
</svg>`,
  's5-ha': `<svg viewBox="0 0 300 156" role="img" aria-label="Half adder truth table: A B to C S" xmlns="http://www.w3.org/2000/svg">
  <g ${FONT} text-anchor="middle" font-size="20" font-weight="700">
    <rect x="22" y="112" width="256" height="30" rx="8" fill="none" stroke="var(--amber)" stroke-width="2"/>
    <text x="64" y="26" font-size="15" fill="var(--muted)">A</text><text x="116" y="26" font-size="15" fill="var(--muted)">B</text>
    <text x="196" y="26" font-size="15" fill="var(--amber)">C</text><text x="246" y="26" font-size="15" fill="var(--amber)">S</text>
    <line x1="22" y1="36" x2="278" y2="36" stroke="var(--border)" stroke-width="2"/>
    <line x1="156" y1="8" x2="156" y2="146" stroke="var(--border)" stroke-width="2"/>
    <g fill="var(--text)">
      <text x="64" y="62">0</text><text x="116" y="62">0</text><text x="196" y="62">0</text><text x="246" y="62">0</text>
      <text x="64" y="87">0</text><text x="116" y="87">1</text><text x="196" y="87">0</text><text x="246" y="87" fill="var(--one)">1</text>
      <text x="64" y="112">1</text><text x="116" y="112">0</text><text x="196" y="112">0</text><text x="246" y="112" fill="var(--one)">1</text>
      <text x="64" y="137">1</text><text x="116" y="137">1</text><text x="196" y="137" fill="var(--one)">1</text><text x="246" y="137">0</text>
    </g>
  </g>
</svg>`,
  's5-fa': `<svg viewBox="0 0 360 150" role="img" aria-label="Full adder from two half adders and an OR gate" xmlns="http://www.w3.org/2000/svg">
  <g ${FONT} text-anchor="middle" font-size="13" fill="none" stroke="var(--muted)" stroke-width="2">
    <path d="M30 36H64M30 58H64M130 36H200V50H254M130 58H146V92H168M96 112H168M236 92H300M236 112H246V66H254M278 58H322"/>
    <rect x="64" y="22" width="66" height="48" rx="9" stroke="var(--one)"/>
    <rect x="168" y="78" width="68" height="48" rx="9" stroke="var(--one)"/>
    <rect x="254" y="40" width="56" height="36" rx="9" stroke="var(--amber)"/>
    <g stroke="none">
      <text x="97" y="52" fill="var(--text)" font-size="15" font-weight="700">HA</text>
      <text x="202" y="108" fill="var(--text)" font-size="15" font-weight="700">HA</text>
      <text x="282" y="63" fill="var(--text)" font-size="15" font-weight="700">OR</text>
      <text x="16" y="40" fill="var(--text)">A</text><text x="16" y="62" fill="var(--text)">B</text>
      <text x="74" y="116" fill="var(--text)">Cin</text>
      <text x="330" y="62" fill="var(--one)" text-anchor="start" font-weight="700">Cout</text>
      <text x="318" y="96" fill="var(--one)" font-weight="700">S</text>
      <text x="146" y="30" fill="var(--muted)" font-size="11">C1</text>
      <text x="152" y="84" fill="var(--muted)" font-size="11">S1</text>
      <text x="262" y="86" fill="var(--muted)" font-size="11">C2</text>
    </g>
  </g>
</svg>`,
  's5-decoder': `<svg viewBox="0 0 320 112" role="img" aria-label="A 3-to-8 decoder: input ABC = 101 turns on output Y5 only" xmlns="http://www.w3.org/2000/svg">
  <g ${FONT} text-anchor="middle">
    <text x="160" y="22" font-size="15" font-weight="700" fill="var(--amber)">ABC = 101</text>
    ${Array.from({ length: 8 }, (_, i) => {
      const x = 28 + i * 38
      const on = i === 5
      return `<circle cx="${x}" cy="58" r="14" fill="${on ? 'var(--one)' : 'none'}" stroke="${on ? 'var(--one)' : 'var(--zero)'}" stroke-width="2"/>
    <text x="${x}" y="63" font-size="13" font-weight="700" fill="${on ? 'var(--on-one)' : 'var(--muted)'}">${on ? 1 : 0}</text>
    <text x="${x}" y="94" font-size="12" fill="${on ? 'var(--one)' : 'var(--muted)'}">Y${i}</text>`
    }).join('\n    ')}
  </g>
</svg>`,
  's5-rom': `<svg viewBox="0 0 340 168" role="img" aria-label="ROM: fixed AND plane and programmable OR plane. PLA: both planes programmable" xmlns="http://www.w3.org/2000/svg">
  ${ARROW}
  <g ${FONT} text-anchor="middle" font-size="12" fill="var(--muted)">
    <text x="30" y="46" font-size="15" font-weight="700" fill="var(--text)">ROM</text>
    <rect x="70" y="20" width="98" height="46" rx="10" fill="none" stroke="var(--zero)" stroke-width="2.5"/>
    <text x="119" y="40" font-size="15" font-weight="700" fill="var(--text)">AND</text><text x="119" y="57">fixed</text>
    <rect x="210" y="20" width="98" height="46" rx="10" fill="none" stroke="var(--amber)" stroke-width="2.5"/>
    <text x="259" y="40" font-size="15" font-weight="700" fill="var(--text)">OR</text><text x="259" y="57" fill="var(--amber)">programmable</text>
    <path d="M168 43H208" stroke="var(--amber)" stroke-width="2" marker-end="url(#s5a)"/>
    <text x="30" y="132" font-size="15" font-weight="700" fill="var(--text)">PLA</text>
    <rect x="70" y="106" width="98" height="46" rx="10" fill="none" stroke="var(--amber)" stroke-width="2.5"/>
    <text x="119" y="126" font-size="15" font-weight="700" fill="var(--text)">AND</text><text x="119" y="143" fill="var(--amber)">programmable</text>
    <rect x="210" y="106" width="98" height="46" rx="10" fill="none" stroke="var(--amber)" stroke-width="2.5"/>
    <text x="259" y="126" font-size="15" font-weight="700" fill="var(--text)">OR</text><text x="259" y="143" fill="var(--amber)">programmable</text>
    <path d="M168 129H208" stroke="var(--amber)" stroke-width="2" marker-end="url(#s5a)"/>
    <line x1="14" y1="86" x2="326" y2="86" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 5"/>
  </g>
</svg>`,
}
