import type { Bit } from '../../../logic/boolean'
import type { Circuit, GateKind } from '../../../logic/circuit'
import type { Assignment, BoolExpr } from '../../../ui/lessons/widgets/types'
import type { Figures, Lesson } from '../../lessons/types'
import { widgetStep } from '../../lessons/widgetTypes'
import { ltr, node as n, wire as w } from '../helpers'
import { syl } from '../syllabus'

/** Stage 3 lessons: 3.1 gates and truth tables, 3.2 the algebra laws and De Morgan, 3.3 NAND and NOR. */

// ---- tiny expression model (no parser): a function plus how it is written ----
const E = (display: string, fn: (v: Assignment) => Bit): BoolExpr => ({ display, fn })
const inv = (b: Bit): Bit => (b ? 0 : 1)
const and = (...bs: Bit[]): Bit => (bs.every(b => b === 1) ? 1 : 0)
const or = (...bs: Bit[]): Bit => (bs.some(b => b === 1) ? 1 : 0)
const A = (v: Assignment) => v.A
const B = (v: Assignment) => v.B
const C = (v: Assignment) => v.C

const NOT_A = E("A'", v => inv(A(v)))
const AND2 = E('A·B', v => and(A(v), B(v)))
const OR2 = E('A+B', v => or(A(v), B(v)))
const AND3 = E('A·B·C', v => and(A(v), B(v), C(v)))
const XOR2 = E('A⊕B', v => (A(v) !== B(v) ? 1 : 0))
const NAND2 = E("(A·B)'", v => inv(and(A(v), B(v))))
const NOR2 = E("(A+B)'", v => inv(or(A(v), B(v))))

/** The inputs of a state (a point on the table) and the rows tried so far. */
const at = (inputs: Assignment, tried: number[]) => ({ inputs, tried })

/** A circuit F(inputs) from gates [id, kind, in0, in1]; the last gate drives F. */
const nand2 = (inputs: string[], gs: [string, GateKind, string, string][]): Circuit => ({
  nodes: [...inputs.map(i => n(i, 'IN', i)), ...gs.map(([id, k]) => n(id, k)), n('F', 'OUT', 'F')],
  wires: [...gs.flatMap(([id, , a, b]) => [w(a, id, 0), w(b, id, 1)]), w(gs[gs.length - 1][0], 'F')],
})
const tt = (inputs: string[], col: Bit[]) => ({ inputs, outputs: ['F'], rows: col.map(v => [v]) })

const q = (id: string, prompt: string, options: string[], correct: number) => ({ id, prompt, options, correct })

const ALG = syl(3)
const GATES = syl(8)

export const lessons: Lesson[] = [
  // ------------------------------------------------------------------ 3.1
  {
    id: 'sw-3-l1', stage: 'sw-3-boolean', order: 1,
    title: 'שערים וטבלאות אמת', minutes: 8,
    blurb: 'מה עושה שער לוגי, איך קוראים טבלת אמת, ושבעת השערים הבסיסיים.',
    source: ALG,
    steps: [
      {
        id: 'bits', kind: 'explain',
        text: `מחשב עובד עם ביטים: כל אות הוא 0 (כבוי) או 1 (דולק). שער לוגי הוא רכיב קטן שמקבל ביט אחד או יותר ומחזיר ביט אחד, לפי כלל קבוע. את הכלל כותבים בטבלת אמת: שורה לכל צירוף אפשרי של הכניסות, ולידה היציאה. נתחיל מהשער הפשוט ביותר, עם כניסה אחת.`,
      },
      widgetStep({
        id: 'not-play', widget: 'GateToy', config: { vars: ['A'], expr: NOT_A, gate: 'NOT' },
        prompt: 'לפניכם שער עם כניסה אחת, A, ונורה ביציאה. הפכו את המתג וראו איך הטבלה מתמלאת. המשיכו עד שכל השורות נוסו.',
        goal: { kind: 'all-rows' }, example: at({ A: 1 }, [0, 1]),
      }),
      {
        id: 'not-law', kind: 'explain',
        text: `זה שער NOT: הוא הופך את הביט. את התוצאה כותבים ${ltr("A'")}, וקוראים "לא A". כל משתנה נוסף מכפיל את מספר השורות פי 2, ולכן ל-n כניסות יש ${ltr('2^n')} שורות: 2, 4, 8 וכן הלאה.`,
      },
      widgetStep({
        id: 'and-play', widget: 'GateToy', config: { vars: ['A', 'B'], expr: AND2, gate: 'AND' },
        prompt: 'עכשיו שער עם שתי כניסות. נסו את כל ארבעת הצירופים, ושימו לב מתי הנורה נדלקת.',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      widgetStep({
        id: 'or-play', widget: 'GateToy', config: { vars: ['A', 'B'], expr: OR2, gate: 'OR' },
        prompt: 'אלה אותן שתי כניסות, אבל שער אחר. נסו את כל הצירופים והשוו לשער הקודם: באילו שורות ההבדל?',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'and-or', kind: 'explain',
        text: `השער הראשון הוא AND (כפל, ${ltr('A·B')}): הוא נותן 1 רק כששתי הכניסות הן 1. השני הוא OR (חיבור, ${ltr('A+B')}): הוא נותן 0 רק כששתיהן 0. כך גם עם שלוש כניסות ויותר: AND דורש שכולן יהיו 1, ו-OR מסתפק בכניסה אחת.`,
      },
      {
        id: 'or-zero', kind: 'check',
        prompt: 'מתי שער OR בעל שתי כניסות נותן 0?',
        options: ['כששתי הכניסות הן 0', 'כשלפחות כניסה אחת היא 0', 'כשבדיוק כניסה אחת היא 1', 'אף פעם'],
        correct: 0,
        feedback: [
          `נכון: OR נותן 1 ברגע שיש כניסה אחת שהיא 1, ולכן הוא 0 רק בשורה ${ltr('A=0, B=0')}.`,
          `זה תיאור של AND: הוא נותן 0 כשלפחות כניסה אחת היא 0. ב-OR, כניסה אחת שהיא 0 לא מספיקה: בשורה ${ltr('A=0, B=1')} היציאה היא 1.`,
          `במקרה כזה היציאה של OR היא 1, לא 0: מספיקה כניסה אחת שהיא 1. למשל בשורה ${ltr('A=0, B=1')} הנורה דולקת.`,
          `יש שורה כזו: כששתי הכניסות הן 0 אין אף 1 שיעביר את ה-OR ל-1, ולכן היציאה היא 0.`,
        ],
      },
      widgetStep({
        id: 'and3', widget: 'GateToy', config: { vars: ['A', 'B', 'C'], expr: AND3, gate: 'AND' },
        prompt: 'שער AND עם שלוש כניסות. מצאו את הצירוף היחיד שמדליק את הנורה.',
        goal: { kind: 'output', value: 1 }, example: at({ A: 1, B: 1, C: 1 }, [0, 7]),
      }),
      {
        id: 'derived', kind: 'explain',
        text: `יש עוד שלושה שערים. NAND הוא AND ואחריו NOT: ${ltr("(A·B)'")}. NOR הוא OR ואחריו NOT: ${ltr("(A+B)'")}. XOR, ${ltr('A ⊕ B')}, נותן 1 כשהכניסות שונות זו מזו, ו-XNOR הוא ההיפוך שלו: 1 כשהן שוות.`,
      },
      widgetStep({
        id: 'xor-play', widget: 'GateToy', config: { vars: ['A', 'B'], expr: XOR2, gate: 'XOR' },
        prompt: 'נסו את כל השורות של XOR ומצאו באילו שורות הנורה דולקת.',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'which-gate', kind: 'check',
        prompt: `בטבלה של שער יש 1 בשורה אחת בלבד: ${ltr('A=0, B=0')}. איזה שער זה?`,
        options: ['AND', 'NOR', 'XNOR', 'NAND'],
        correct: 1,
        feedback: [
          `AND נותן 1 בשורה אחת בלבד, אבל זו השורה ${ltr('A=1, B=1')} ולא שורת האפסים.`,
          'נכון: OR נותן 0 רק כששתי הכניסות הן 0, ו-NOR מהפך אותו, ולכן הוא נותן 1 רק שם.',
          `XNOR נותן 1 כשהכניסות שוות, כלומר גם ב-${ltr('A=0, B=0')} וגם ב-${ltr('A=1, B=1')}: שתי שורות, לא אחת.`,
          'NAND נותן 0 רק כששתי הכניסות הן 1, ובשלוש השורות האחרות הוא נותן 1. כאן יש 1 בשורה אחת בלבד.',
        ],
      },
      widgetStep({
        id: 'box', widget: 'GateToy', config: { vars: ['A', 'B', 'C'], expr: E("(A+B)·C'", v => and(or(A(v), B(v)), inv(C(v)))) },
        prompt: `לא תמיד יש שער יחיד: כאן יש ביטוי שלם, ${ltr("(A+B)·C'")}. עברו על כל 8 השורות ומלאו את הטבלה.`,
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1, C: 1 }, [0, 1, 2, 3, 4, 5, 6, 7]),
      }),
      {
        id: 'count-rows', kind: 'check',
        prompt: 'בכמה מתוך 8 השורות הנורה דולקת?',
        options: ['2', '3', '4', '6'],
        correct: 1,
        feedback: [
          `ספרתם רק שורות שבהן בדיוק אחד מ-A ו-B הוא 1. אבל OR נותן 1 גם כששניהם 1, ולכן גם השורה ${ltr('A=1, B=1, C=0')} נספרת.`,
          `נכון: C חייב להיות 0, ו-${ltr('A+B')} חייב להיות 1. לצירוף ${ltr('AB')} יש שלוש אפשרויות כאלה: ${ltr('01, 10, 11')}.`,
          `ספרתם רק את התנאי ${ltr('C=0')}. הביטוי הוא AND של שני חלקים, ולכן בדקו בכל אחת מהשורות האלה גם את הסוגריים ${ltr('A+B')}: האם הם תמיד 1?`,
          `ספרתם רק את התנאי ${ltr('A+B=1')}. הביטוי הוא AND, ולכן גם ${ltr("C'")} חייב להיות 1: בדקו בכל אחת מהשורות האלה מה ערכו של C.`,
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `טבלת אמת מציגה את היציאה לכל צירוף כניסות, ול-n כניסות יש ${ltr('2^n')} שורות.`,
          'AND נותן 1 רק כשכל הכניסות 1, OR נותן 0 רק כשכולן 0, ו-NOT הופך את הביט.',
          'NAND ו-NOR הם AND ו-OR ואחריהם NOT. XOR נותן 1 כשהכניסות שונות.',
          'ביטוי מורכב בודקים שורה אחרי שורה, ומחשבים את היציאה מהסוגריים החוצה.',
        ],
      },
    ],
    skipQuiz: [
      q('q1', 'כמה שורות יש בטבלת אמת של פונקציה בשלושה משתנים?', ['3', '6', '8', '9'], 2),
      q('q2', `מה היציאה של שער AND עם הכניסות ${ltr('A=1, B=0')}?`, ['0', '1', 'תלוי בסדר הכניסות', 'לא מוגדר'], 0),
      q('q3', 'מתי שער NAND בעל שתי כניסות נותן 0?', ['כששתי הכניסות הן 1', 'כששתי הכניסות הן 0', 'כשיש לפחות כניסה אחת שהיא 1', 'כשהכניסות שונות'], 0),
      q('q4', 'מתי שער XOR בעל שתי כניסות נותן 1?', ['כשהכניסות שונות זו מזו', 'כששתי הכניסות הן 1', 'כשהכניסות שוות', 'כשלפחות כניסה אחת היא 0'], 0),
      q('q5', 'מתי שער NOR בעל שתי כניסות נותן 1?', ['כששתי הכניסות הן 0', 'כשיש לפחות כניסה אחת שהיא 1', 'כשהכניסות שונות', 'כששתי הכניסות הן 1'], 0),
      q('q6', 'איזה שער נותן 1 בכל השורות חוץ מהשורה שבה כל הכניסות הן 1?', ['AND', 'NAND', 'OR', 'NOR'], 1),
      q('q7', `מה ערכו של ${ltr("(A+B)·C'")} כש-${ltr('A=0, B=1, C=0')}?`, ['0', '1'], 1),
    ],
  },

  // ------------------------------------------------------------------ 3.2
  {
    id: 'sw-3-l2', stage: 'sw-3-boolean', order: 2,
    title: 'חוקי האלגברה ודה-מורגן', minutes: 9,
    blurb: 'איך מוכיחים ששני ביטויים שווים, החוקים הבסיסיים, והחוק של דה-מורגן.',
    source: ALG,
    steps: [
      {
        id: 'identity', kind: 'explain',
        text: `שני ביטויים בוליאניים שקולים אם הם נותנים אותה יציאה בכל צירוף כניסות. כך מוכיחים זהות: בונים טבלת אמת לשניהם ובודקים שהעמודות זהות. כדי להפריך מספיקה שורה אחת שבה הם נבדלים. נבדוק אם ${ltr('A + A·B')} הוא בעצם ${ltr('A')} בלבד.`,
      },
      widgetStep({
        id: 'absorb', widget: 'IdentityBench',
        config: { vars: ['A', 'B'], left: E('A+A·B', v => or(A(v), and(A(v), B(v)))), right: E('A', A) },
        prompt: `הביטויים ${ltr('f')} ו-${ltr('g')} מוצגים זה מול זה. נסו את כל השורות, או לחצו "הריצו את כל השורות", ובדקו אם הם נבדלים אי פעם.`,
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'basic-laws', kind: 'explain',
        text: `הזהות שבדקתם נקראת חוק ההבלעה. עוד חוקים בסיסיים: ${ltr('A + 0 = A')}, ${ltr('A · 1 = A')}, ${ltr('A + 1 = 1')}, ${ltr('A · 0 = 0')}, ${ltr('A + A = A')}, ${ltr('A · A = A')}, ${ltr("A + A' = 1")}, ${ltr("A · A' = 0")} ו-${ltr("(A')' = A")}. כל אחד נבדק בטבלה של שתי שורות.`,
      },
      {
        id: 'complement', kind: 'check',
        prompt: `מה ערכו של ${ltr("A · A'")}?`,
        options: ['תמיד 0', 'תמיד 1', 'A', "A'"],
        correct: 0,
        feedback: [
          `נכון: A ו-${ltr("A'")} תמיד הפוכים זה לזה, ולכן לפחות אחד מהם 0, ומכפלה שיש בה 0 היא 0.`,
          `זה ה-OR: ${ltr("A + A' = 1")}. ב-AND צריך ששני הגורמים יהיו 1, וזה בלתי אפשרי כי הם הפוכים.`,
          `${ltr('A · A = A')} הוא חוק אחר. כאן הגורם השני הוא ${ltr("A'")}, ולא A.`,
          `כש-${ltr('A=0')} המכפלה היא ${ltr('0 · 1 = 0')}, וזה שונה מ-${ltr("A'=1")}. לכן התשובה לא יכולה להיות ${ltr("A'")}.`,
        ],
      },
      {
        id: 'distribute', kind: 'explain',
        text: `בניגוד לאלגברה הרגילה, בבוליאנית יש פילוג כפול: ${ltr('A·(B+C) = A·B + A·C')}, אבל גם ${ltr('A + B·C = (A+B)·(A+C)')}. הזהות השנייה נראית מוזרה, אז בדקו אותה בעצמכם. עם שלוש כניסות יש 8 שורות.`,
      },
      widgetStep({
        id: 'distribute-bench', widget: 'IdentityBench',
        config: { vars: ['A', 'B', 'C'], left: E('A+B·C', v => or(A(v), and(B(v), C(v)))), right: E('(A+B)·(A+C)', v => and(or(A(v), B(v)), or(A(v), C(v)))) },
        prompt: 'הריצו את כל 8 השורות. האם העמודות זהות?',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1, C: 1 }, [0, 1, 2, 3, 4, 5, 6, 7]),
      }),
      {
        id: 'distribute-check', kind: 'check',
        prompt: `למה שווה ${ltr('A·(B+C)')}?`,
        options: ['A·B + A·C', 'A·B + C', 'A + B·C', 'A·B·C'],
        correct: 0,
        feedback: [
          'נכון: A מוכפל בכל אחד מהמחוברים בסוגריים.',
          `C נשאר בלי A. כש-${ltr('A=0, C=1')} אגף שמאל הוא 0, אבל ${ltr('A·B + C')} הוא 1.`,
          `זה הפילוג של OR על AND, חוק אחר. כש-${ltr('A=1, B=0, C=0')} הביטוי ${ltr('A + B·C')} הוא 1, אבל ${ltr('A·(B+C)')} הוא 0.`,
          `כאן הוחלף ה-OR ב-AND. כש-${ltr('A=1, B=1, C=0')} הביטוי ${ltr('A·(B+C)')} הוא 1, אבל ${ltr('A·B·C')} הוא 0.`,
        ],
      },
      {
        id: 'demorgan', kind: 'explain',
        text: `חוקי דה-מורגן: ${ltr("(A·B)' = A' + B'")} ו-${ltr("(A+B)' = A' · B'")}. כלל זיכרון: מפצלים את ההיפוך לכל משתנה בנפרד, ומחליפים AND ב-OR ולהפך. אם רק מפצלים את ההיפוך, בלי להחליף את הפעולה, מקבלים טעות נפוצה.`,
      },
      widgetStep({
        id: 'demorgan-wrong', widget: 'IdentityBench',
        config: { vars: ['A', 'B'], left: E("(A+B)'", v => inv(or(A(v), B(v)))), right: E("A'+B'", v => or(inv(A(v)), inv(B(v)))) },
        prompt: `זו הטעות הנפוצה: ${ltr('f')} הוא ${ltr("(A+B)'")} ו-${ltr('g')} הוא ${ltr("A'+B'")}. מצאו שורה שבה הם נבדלים.`,
        goal: { kind: 'find-difference' }, example: at({ A: 0, B: 1 }, [0, 1]),
      }),
      widgetStep({
        id: 'demorgan-right', widget: 'IdentityBench',
        config: { vars: ['A', 'B'], left: E("(A+B)'", v => inv(or(A(v), B(v)))), right: E("A'·B'", v => and(inv(A(v)), inv(B(v)))) },
        prompt: `עכשיו עם החלפת הפעולה: ${ltr('g')} הוא ${ltr("A'·B'")}. הריצו את כל השורות.`,
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'demorgan-three', kind: 'check',
        prompt: `מהו ${ltr("(A·B·C)'")} לפי דה-מורגן?`,
        options: ["A' + B' + C'", "A' · B' · C'", "A' + B' + C", 'A + B + C'],
        correct: 0,
        feedback: [
          'נכון: מהפכים כל משתנה ומחליפים את ה-AND ב-OR. החוק תקף לכל מספר משתנים.',
          `היפוך כל משתנה בלי להחליף את הפעולה. הביטוי ${ltr("A'·B'·C'")} שווה ל-${ltr("(A+B+C)'")}, והוא 1 רק בשורה ${ltr('000')}, בעוד ${ltr("(A·B·C)'")} הוא 1 בכל שורה חוץ מ-${ltr('111')}.`,
          `כאן נשכח להפוך את C. כש-${ltr('A=1, B=1, C=0')} הביטוי ${ltr("(A·B·C)'")} הוא 1, אבל ${ltr("A'+B'+C")} הוא 0.`,
          `כאן לא הפכו כלום. כש-${ltr('A=B=C=0')} הביטוי ${ltr("(A·B·C)'")} הוא 1, אבל ${ltr('A+B+C')} הוא 0.`,
        ],
      },
      {
        id: 'not-identity', kind: 'check',
        prompt: 'איזה מהשוויונות הבאים אינו זהות, כלומר לא נכון לכל A ו-B?',
        options: [ltr('A + A·B = A'), ltr('A·(A+B) = A'), ltr("A + A'·B = A"), ltr("A·(A'+B) = A·B")],
        correct: 2,
        feedback: [
          'זה חוק ההבלעה שבדקתם בטבלה, והוא נכון לכל A ו-B.',
          `זו גרסה של חוק ההבלעה, עם AND בחוץ. כש-${ltr('A=0')} שני האגפים הם 0, וכש-${ltr('A=1')} אגף שמאל הוא ${ltr('1·(1+B) = 1')}.`,
          `נכון, זו לא זהות: כש-${ltr('A=0, B=1')} אגף שמאל הוא ${ltr("0 + 1·1 = 1")} ואגף ימין הוא 0. בעצם ${ltr("A + A'·B = A + B")}.`,
          `זו זהות: ${ltr("A·A' = 0")}, ולכן אחרי הפילוג נשאר ${ltr('A·B')}.`,
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          'זהות מוכיחים בטבלת אמת: העמודות חייבות להיות זהות בכל השורות, ושורה אחת שונה מפריכה.',
          `חוקי יסוד: ${ltr("A + A' = 1")}, ${ltr("A · A' = 0")}, הבלעה ${ltr('A + A·B = A')}, וגם ${ltr('A + B·C = (A+B)·(A+C)')}.`,
          `דה-מורגן: ${ltr("(A·B)' = A' + B'")} ו-${ltr("(A+B)' = A' · B'")}. מפצלים את ההיפוך ומחליפים את הפעולה.`,
        ],
      },
    ],
    skipQuiz: [
      q('q1', `מה ערכו של ${ltr("A + A'")}?`, ['0', '1', 'A', "A'"], 1),
      q('q2', `איזה ביטוי שקול ל-${ltr("(A+B)'")}?`, ["A' + B'", "A' · B'", 'A · B', "A + B'"], 1),
      q('q3', `מה ערכו של ${ltr('A · 0')}?`, ['0', '1', 'A', "A'"], 0),
      q('q4', 'איזו משוואה היא זהות?', [ltr('A + B·C = (A+B)·(A+C)'), ltr('A + B·C = (A+B)·C'), ltr('A·(B+C) = A·B + C'), ltr("(A+B)' = A' + B'")], 0),
      q('q5', 'איך מוכיחים בעזרת טבלת אמת ששני ביטויים שקולים?', ['בודקים שהם שווים בכל השורות', 'בודקים שהם שווים בשורה אחת', 'בודקים שיש בהם אותו מספר משתנים', 'בודקים שבשורה הראשונה שניהם 0'], 0),
      q('q6', 'איך מפריכים בעזרת טבלת אמת שוויון בין שני ביטויים?', ['מוצאים שורה אחת שבה הם נבדלים', 'בודקים שהם שווים בכל השורות', 'מוצאים שורה אחת שבה הם שווים', 'סופרים את מספר האחדים בעמודה אחת'], 0),
      q('q7', `למה שווה ${ltr("(A·B)'")}?`, ["A' + B'", "A' · B'", 'A + B', 'A · B'], 0),
      q('q8', `למה שווה ${ltr('A + A·B')}?`, ['A', 'B', 'A + B', 'A · B'], 0),
    ],
  },

  // ------------------------------------------------------------------ 3.3
  {
    id: 'sw-3-l3', stage: 'sw-3-boolean', order: 3,
    title: 'NAND ו-NOR: שערים אוניברסליים', minutes: 10,
    blurb: 'איך בונים NOT, AND ו-OR משערי NAND בלבד, ולמה זה מספיק לכל מעגל.',
    source: GATES,
    steps: [
      {
        id: 'nand-nor', kind: 'explain',
        text: `בשיעור הזה נבנה מעגלים משני שערים בלבד. ${ltr("NAND(A,B) = (A·B)'")} הוא AND שהיציאה שלו מהופכת, ו-${ltr("NOR(A,B) = (A+B)'")} הוא OR שהיציאה שלו מהופכת. נתחיל בכך שנראה איך הם מתנהגים.`,
      },
      widgetStep({
        id: 'nand-play', widget: 'GateToy', config: { vars: ['A', 'B'], expr: NAND2, gate: 'NAND' },
        prompt: 'נסו את כל הצירופים של NAND. הנורה כבויה בשורה אחת בלבד: באיזו?',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      widgetStep({
        id: 'nor-play', widget: 'GateToy', config: { vars: ['A', 'B'], expr: NOR2, gate: 'NOR' },
        prompt: 'ועכשיו NOR. הנורה דולקת בשורה אחת בלבד: באיזו?',
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'universal', kind: 'explain',
        text: `שער אוניברסלי הוא שער שאפשר לבנות ממנו, לבדו, כל פונקציה בוליאנית. כל פונקציה אפשר לכתוב בעזרת AND, OR ו-NOT: OR של מכפלות, מכפלה לכל שורה שבה היא 1. את OR מקבלים מ-AND ו-NOT בדה-מורגן, ולכן מספיק לבנות NOT ו-AND. הטריק ל-NOT: מחברים את שתי הכניסות של NAND לאותו אות, ומקבלים ${ltr("(A·A)' = A'")}.`,
      },
      widgetStep({
        id: 'tie-inputs', widget: 'IdentityBench',
        config: { vars: ['A'], left: E("(A·A)'", v => inv(and(A(v), A(v)))), right: E("A'", v => inv(A(v))) },
        prompt: `${ltr('f')} הוא NAND ששתי כניסותיו מחוברות ל-A, ו-${ltr('g')} הוא NOT. הריצו את כל השורות והשוו.`,
        goal: { kind: 'all-rows' }, example: at({ A: 1 }, [0, 1]),
      }),
      {
        id: 'try-not', kind: 'try',
        prompt: 'בנו מהפך, כלומר NOT, משער NAND אחד. הכניסה היא A והיציאה היא F.',
        puzzle: {
          type: 'circuit', spec: tt(['A'], [1, 0]), allowed: ['NAND'], optimalGates: 1,
          reference: nand2(['A'], [['g1', 'NAND', 'A', 'A']]),
        },
        hints: [
          { text: 'מה NAND נותן כששתי הכניסות שלו שוות?' },
          { text: `חברו את A לשתי הכניסות של אותו שער: ${ltr("NAND(A,A) = (A·A)' = A'")}.` },
        ],
      },
      {
        id: 'and-from-nand', kind: 'explain',
        text: `AND הוא NAND ואחריו NOT. מהפך כבר בנינו מ-NAND, ולכן AND דורש שני שערים: הראשון מחשב ${ltr("(A·B)'")}, והשני, עם כניסות מחוברות, מהפך אותו בחזרה: ${ltr("((A·B)')' = A·B")}.`,
      },
      {
        id: 'try-and', kind: 'try',
        prompt: 'עכשיו בנו AND משערי NAND בלבד, עם שתי כניסות לכל שער. הכניסות הן A ו-B והיציאה היא F.',
        puzzle: {
          type: 'circuit', spec: tt(['A', 'B'], [0, 0, 0, 1]), allowed: ['NAND'], optimalGates: 2,
          reference: nand2(['A', 'B'], [['g1', 'NAND', 'A', 'B'], ['g2', 'NAND', 'g1', 'g1']]),
        },
        hints: [
          { text: `השער הראשון הוא ${ltr('NAND(A,B)')}.` },
          { text: 'חברו את היציאה של השער הראשון לשתי הכניסות של שער NAND שני.' },
        ],
      },
      widgetStep({
        id: 'or-from-nand', widget: 'IdentityBench',
        config: { vars: ['A', 'B'], left: E('A+B', v => or(A(v), B(v))), right: E("(A'·B')'", v => inv(and(inv(A(v)), inv(B(v))))) },
        prompt: `לפי דה-מורגן ${ltr('A+B')} שווה ל-${ltr("(A'·B')'")}, שהוא NAND של שני אותות מהופכים. הריצו את כל השורות ובדקו.`,
        goal: { kind: 'all-rows' }, example: at({ A: 1, B: 1 }, [0, 1, 2, 3]),
      }),
      {
        id: 'or-count', kind: 'check',
        prompt: `כמה שערי NAND דו-כניסתיים נדרשים כדי לממש ${ltr('A+B')} בדרך שבה נבנה ${ltr('g')}?`,
        options: ['2', '3', '4', '5'],
        correct: 1,
        feedback: [
          `חסר שער. כתבו את ${ltr("(A'·B')'")} כמעגל וספרו: כל משתנה מהופך דורש מהפך משלו, וגם הצירוף ביניהם הוא שער.`,
          `נכון: שני שערים בתור מהפכים, ושער שלישי מחשב ${ltr("NAND(A',B')")}.`,
          `אין צורך במהפך נוסף ביציאה: ${ltr("(A'·B')'")} כבר נותן את OR, ישירות מ-NAND אחד.`,
          `יותר מדי. כתבו את ${ltr("(A'·B')'")} כמעגל וספרו: המכפלה וההיפוך החיצוני הם יחד שער NAND אחד, ולא שני שערים.`,
        ],
      },
      {
        id: 'which-universal', kind: 'check',
        prompt: 'איזו קבוצת שערים, בלי הקבועים 0 ו-1, מספיקה כדי לבנות כל פונקציה בוליאנית?',
        options: ['AND ו-OR בלבד', 'XOR בלבד', 'NOR בלבד', 'AND, OR ו-XOR'],
        correct: 2,
        feedback: [
          `כשכל הכניסות הן 0, גם AND וגם OR נותנים 0, ולכן כל מעגל שבנוי מהם נותן 0 בשורת האפסים. מהפך נותן שם 1, ולכן אי אפשר לבנות אותו.`,
          `גם ${ltr('XOR(0,0) = 0')}: כל מעגל XOR נותן 0 בשורת האפסים, ולכן אי אפשר לקבל ממנו מהפך.`,
          `נכון: ${ltr("NOR(A,A) = A'")} נותן NOT, ומשם דה-מורגן נותן את השאר: ${ltr("A·B = (A'+B')'")}.`,
          'שלושתם נותנים 0 כשכל הכניסות הן 0, ולכן כל צירוף שלהם נותן 0 בשורת האפסים. מהפך אי אפשר לבנות.',
        ],
      },
      {
        id: 'recap', kind: 'recap',
        points: [
          `NAND הוא AND ואחריו NOT, ו-NOR הוא OR ואחריו NOT. שניהם אוניברסליים.`,
          `מהפך משער NAND: מחברים את שתי הכניסות לאותו אות, ${ltr("NAND(A,A) = A'")}.`,
          'AND הוא NAND ואחריו מהפך (שני שערים), ו-OR הוא NAND של שני אותות מהופכים (שלושה שערים).',
          'בלי הקבועים 0 ו-1, AND, OR ו-XOR לא אוניברסליים: הם נותנים 0 כשכל הכניסות 0, ולכן לא ניתן לבנות מהם מהפך.',
        ],
      },
    ],
    skipQuiz: [
      q('q1', `מה ערכו של ${ltr('NAND(A,A)')}?`, ['A', "A'", '0', '1'], 1),
      q('q2', 'מתי שער NOR בעל שתי כניסות נותן 1?', ['כששתי הכניסות הן 0', 'כשיש לפחות כניסה אחת שהיא 1', 'כשהכניסות שונות', 'כששתי הכניסות הן 1'], 0),
      q('q3', 'מה מקבלים כשמחברים את היציאה של NAND למהפך?', ['AND', 'OR', 'NOR', 'XOR'], 0),
      q('q4', 'מה פירוש "שער אוניברסלי"?', ['אפשר לממש בעזרתו, לבדו, כל פונקציה בוליאנית', 'הוא המהיר ביותר מבין השערים', 'יש לו כניסה אחת בלבד', 'היציאה שלו תמיד 1'], 0),
      q('q5', 'כמה שערי NAND דו-כניסתיים לפחות צריך כדי לבנות מהפך?', ['1', '2', '3', '4'], 0),
      q('q6', 'כמה שערי NAND דו-כניסתיים לפחות צריך כדי לבנות AND?', ['1', '2', '3', '4'], 1),
      q('q7', 'איזה שער, לבדו, אינו אוניברסלי?', ['NAND', 'NOR', 'XOR'], 2),
      q('q8', `איזה ביטוי שקול ל-${ltr('A+B')}?`, [ltr("(A'·B')'"), ltr("(A'+B')'"), ltr("A'·B'"), ltr("(A·B)'")], 0),
    ],
  },
]

/** Inline SVG figures for this stage's explain steps, by id. */
export const figures: Figures = {}
