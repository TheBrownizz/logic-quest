import type { Card } from '../types'
import { cardsFor, ltr } from './helpers'
import { syl } from './syllabus'

const { claim, mcq } = cardsFor('sw-3-boolean')
const ALG = syl(3)
const GATES = syl(8)

export const cards3: Card[] = [
  claim('sw-3-c1', {
    text: 'שער NAND לבדו מספיק כדי לממש כל פונקציה בוליאנית.',
    isTrue: true,
    reasons: [
      "אפשר לממש באמצעותו NOT ו-AND, וקבוצה זו שלמה",
      "כל שער בעל שתי כניסות הוא אוניברסלי, ו-NAND הוא שער כזה",
      "ההשהיה של NAND קטנה מזו של שאר השערים",
    ],
    correctReason: 0,
    examReason: 'NAND נותן NOT ו-AND, ואלה מספיקים לכל פונקציה.',
    knowledge: 'NAND ו-NOR הם שערים אוניברסליים: כל פונקציה בוליאנית ניתנת למימוש בהם בלבד.',
    source: GATES,
  }),
  claim('sw-3-c2', {
    text: 'גם שער XOR לבדו מספיק כדי לממש כל פונקציה בוליאנית.',
    isTrue: false,
    reasons: [
      "צירופי XOR נותנים רק XOR של משתנים (ואולי היפוך), ואי אפשר לקבל מהם AND",
      "כל שער בעל שתי כניסות אינו אוניברסלי, ו-XOR הוא שער כזה",
      "XOR אינו מוגדר כששתי כניסותיו שוות, ולכן אינו שלם",
    ],
    correctReason: 0,
    examReason: 'מ-XOR בלבד מקבלים רק XOR של משתנים; אי אפשר לבנות AND.',
    knowledge: 'XOR אינו אוניברסלי: כל מעגל XOR מחשב זוגיות של חלק מהכניסות. גם עם הקבוע 1 אפשר להוסיף רק היפוך, לא AND.',
    source: GATES,
  }),
  claim('sw-3-c3', {
    text: `לכל A ו-B מתקיים ${ltr("(A·B)' = A' + B'")}.`,
    isTrue: true,
    reasons: [
      "זהו חוק דה-מורגן; אפשר לאמת בטבלת אמת של ארבע שורות",
      `זהו חוק הבליעה: ${ltr('A·B')} נבלע ב-${ltr('A + B')}`,
      `בכל שורת טבלה ${ltr('A·B')} ו-${ltr('A + B')} שווים, ולכן גם משלימיהם שווים`,
    ],
    correctReason: 0,
    examReason: 'חוק דה-מורגן: משלים מכפלה הוא סכום המשלימים.',
    knowledge: `דה-מורגן: ${ltr("(A·B)' = A' + B'")} ו-${ltr("(A + B)' = A'·B'")}. מהפכים כל משתנה ומחליפים AND ↔ OR.`,
    source: ALG,
  }),
  claim('sw-3-c4', {
    text: `לכל A ו-B מתקיים ${ltr("(A + B)' = A' + B'")}.`,
    isTrue: false,
    reasons: [
      `לפי דה-מורגן ${ltr("(A + B)' = A'·B'")}; עבור ${ltr('A = 1')}, ${ltr('B = 0')} הצדדים שונים`,
      `לפי דה-מורגן מהפכים רק את המשתנה השני: ${ltr("(A + B)' = A + B'")}`,
      `עבור ${ltr('A = B = 0')} הצד השמאלי 1 והצד הימני 0`,
    ],
    correctReason: 0,
    examReason: `לפי דה-מורגן זה ${ltr("A'·B'")}; ב-${ltr('A=1')}, ${ltr('B=0')} מתקבל 0 מול 1.`,
    knowledge: `בדה-מורגן הופכים גם את הפעולה: OR הופך ל-AND. ${ltr("(A + B)' = A'B'")}.`,
    source: ALG,
  }),
  claim('sw-3-c5', {
    text: `לכל A ו-B מתקיים ${ltr('A + A·B = A')}.`,
    isTrue: true,
    reasons: [
      `${ltr('A + AB = A(1 + B) = A·1 = A')} (חוק הבליעה)`,
      `${ltr('A·B = A')} לכל ערך של B, ולכן ${ltr('A + A = A')}`,
      `בכל שורה שבה ${ltr('A = 1')} מתקיים ${ltr('B = 0')}, ולכן ${ltr('AB = 0')}`,
    ],
    correctReason: 0,
    examReason: `חוק הבליעה: ${ltr('A(1+B) = A')}.`,
    knowledge: `חוקי הבליעה: ${ltr('A + AB = A')} ו-${ltr('A(A + B) = A')}.`,
    source: ALG,
  }),
  claim('sw-3-c6', {
    text: `לכל A ו-B מתקיים ${ltr("A + A'·B = B")}.`,
    isTrue: false,
    reasons: [
      `${ltr("A + A'B = A + B")}; עבור ${ltr('A = 1')}, ${ltr('B = 0')} מתקבל 1 ולא 0`,
      `${ltr("A + A'B = A")} לפי חוק הבליעה, ולא B`,
      `A ו-${ltr("A'")} מבטלים זה את זה, ולכן הביטוי שווה 0`,
    ],
    correctReason: 0,
    examReason: `${ltr("A + A'B = A + B")}; ב-${ltr('A=1')}, ${ltr('B=0')} מתקבל 1, לא 0.`,
    knowledge: `${ltr("A + A'B = (A + A')(A + B) = A + B")}. זהות שימושית לפישוט.`,
    source: ALG,
  }),
  claim('sw-3-c7', {
    text: 'שער NOR ששתי כניסותיו מחוברות יחד מממש שער AND.',
    isTrue: false,
    reasons: [
      `${ltr("NOR(A,A) = (A + A)' = A'")}, כלומר מהפך`,
      `${ltr('NOR(A,A) = A + A = A')}, כלומר חוצץ ${ltr('(Buffer)')}`,
      "NOR עם כניסות שוות נותן תמיד 0",
    ],
    correctReason: 0,
    examReason: `${ltr("NOR(A,A) = A'")}, כלומר מתקבל מהפך ולא AND.`,
    knowledge: `גם ${ltr('NAND(A,A)')} וגם ${ltr('NOR(A,A)')} נותנים ${ltr("A'")}. כך מקבלים מהפך משערים אוניברסליים.`,
    source: GATES,
  }),
  claim('sw-3-c8', {
    text: 'יש 2 בחזקת (2 בחזקת n) פונקציות בוליאניות שונות של n משתנים.',
    isTrue: true,
    reasons: [
      `בטבלת האמת ${ltr('2^n')} שורות, ובכל שורה היציאה 0 או 1`,
      "כל משתנה מכפיל את מספר הפונקציות פי 2, ולכן מעלים את 2 בחזקה פעמיים",
      `יש ${ltr('2^n')} מינטרמים, וכל פונקציה היא מכפלה של כל המינטרמים בחזקת עצמם`,
    ],
    correctReason: 0,
    examReason: `לכל אחת מ-${ltr('2^n')} השורות בוחרים 0 או 1 באופן בלתי תלוי.`,
    knowledge: `למשל לשני משתנים יש ${ltr('2^4 = 16')} פונקציות שונות, ביניהן AND, OR, XOR, NAND ו-NOR.`,
    source: ALG,
  }),
  claim('sw-3-c9', {
    text: `הביטוי ${ltr('A ⊕ B ⊕ C')} שווה 1 רק כאשר ${ltr('A = B = C = 1')}.`,
    isTrue: false,
    reasons: [
      `XOR שווה 1 כשמספר האחדות אי-זוגי, למשל גם ב-${ltr('A=1')}, ${ltr('B=0')}, ${ltr('C=0')}`,
      "XOR של שלושה משתנים שווה 1 כשבדיוק שניים מהם 1",
      `XOR של שלושה משתנים שווה תמיד 0, כי ${ltr('XOR(A,A) = 0')}`,
    ],
    correctReason: 0,
    examReason: 'XOR שווה 1 במספר אי-זוגי של אחדות, למשל 100.',
    knowledge: 'XOR של כמה משתנים הוא פונקציית זוגיות: 1 כשמספר האחדות אי-זוגי. זה הסכום S של מחבר מלא.',
    source: ALG,
  }),
  mcq('sw-3-c10', {
    text: 'כמה שערי NAND דו-כניסתיים נדרשים לכל הפחות למימוש שער OR?',
    options: ['3', '1', '2', '4', '5', '6'],
    correct: 0,
    knowledge: `${ltr("A + B = NAND(A', B')")}: שני NAND כמהפכים ועוד NAND אחד. אי אפשר בפחות.`,
    source: GATES,
  }),
  mcq('sw-3-c11', {
    text: 'כמה שערי NAND דו-כניסתיים נדרשים לכל הפחות למימוש XOR?',
    options: ['4', '2', '3', '5', '6', '8'],
    correct: 0,
    knowledge: `${ltr('g1 = NAND(A,B)')}, ואז ${ltr('NAND(NAND(A,g1), NAND(B,g1))')}. השיתוף של g1 חוסך שער לעומת המימוש הישיר ${ltr('(5)')}.`,
    source: GATES,
  }),
  mcq('sw-3-c12', {
    text: `איזה ביטוי שקול ל-${ltr("(A'B + AB')'")}?`,
    options: ['AB + A\'B\'', 'A\'B + AB\'', 'A + B', '(A + B)\'', 'A\'B\'', 'AB'],
    correct: 0,
    knowledge: `${ltr("A'B + AB'")} הוא XOR, והמשלים שלו הוא XNOR: ${ltr("AB + A'B'")}, שווה 1 כשהכניסות שוות.`,
    source: ALG,
  }),
  mcq('sw-3-c13', {
    text: `מהו הביטוי הדואלי של ${ltr('A + B·C')}?`,
    options: ['A·(B + C)', 'A\'·(B\' + C\')', 'A + B + C', 'A·B + C', '(A + B)·(A + C)', 'A\' + B\'·C\''],
    correct: 0,
    knowledge: `בדואלי מחליפים AND ↔ OR (ו-0 ↔ 1) בלי להפוך משתנים. ${ltr('(A + B)(A + C)')} שקול לביטוי המקורי, אבל אינו הדואלי שלו.`,
    source: ALG,
  }),
  mcq('sw-3-c14', {
    text: 'באחת הכניסות של שער NAND מחובר קבוע 1, ובשנייה הכניסה X. מה מממש השער?',
    options: ['NOT של X', 'X עצמו (חוצץ)', 'קבוע 0', 'קבוע 1', 'AND', 'OR'],
    correct: 0,
    knowledge: `${ltr("NAND(1, X) = (1·X)' = X'")}. לעומת זאת ${ltr('NAND(0, X) = 1')} קבוע.`,
    source: GATES,
  }),
  mcq('sw-3-c15', {
    text: `${ltr("F(A,B,C) = A'B + AC")}. מהי F כסכום מינטרמים?`,
    options: ['Σ(2,3,5,7)', 'Σ(2,3,4,6)', 'Σ(1,3,5,7)', 'Σ(2,3,5,6)', 'Σ(0,1,4,6)', 'Σ(3,5,7)'],
    correct: 0,
    knowledge: `${ltr("A'B")} מכסה את 010 ו-${ltr('011 (2,3)')}; AC מכסה את 101 ו-${ltr('111 (5,7)')}.`,
    source: ALG,
  }),
  mcq('sw-3-c16', {
    text: 'באיזה שער היציאה 1 אם ורק אם שתי הכניסות שוות?',
    options: ['XNOR', 'XOR', 'NAND', 'NOR', 'AND', 'OR'],
    correct: 0,
    knowledge: `${ltr("XNOR = (A ⊕ B)' = AB + A'B'")} הוא "שער השוויון". XOR מזהה כניסות שונות.`,
    source: GATES,
  }),
]
