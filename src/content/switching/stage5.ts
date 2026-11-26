import type { Circuit, Node, Wire } from '../../logic/circuit'
import type { Out } from '../../logic/boolean'
import type { Stage } from '../types'
import { muxTree, romBits } from '../../logic/sizing'
import { node as n, wire as w } from './helpers'
import { cards5 } from './stage5-cards'

/** MUX 2×1 from gates: Y = S'·I0 + S·I1. Optional per-gate delays for the delay room. */
const mux2 = (d?: { not: number; and: number; or: number }): Circuit => ({
  nodes: [
    n('I0', 'IN', 'I0'), n('I1', 'IN', 'I1'), n('S', 'IN', 'S'),
    n('g1', 'NOT', undefined, d?.not), n('g2', 'AND', undefined, d?.and), n('g3', 'AND', undefined, d?.and), n('g4', 'OR', undefined, d?.or),
    n('Y', 'OUT', 'Y'),
  ],
  wires: [
    w('S', 'g1'), w('I0', 'g2', 0), w('g1', 'g2', 1), w('I1', 'g3', 0), w('S', 'g3', 1),
    w('g2', 'g4', 0), w('g3', 'g4', 1), w('g4', 'Y'),
  ],
})

/**
 * Full adder from 8 gates of {NAND, OR} (exhaustive search shows 7 are not enough):
 * X = NAND(NAND(A,B), A+B) = XNOR(A,B); Cout = NAND(NAND(A,B), NAND(Cin, A+B)); S = NAND(NAND(Cin,X), Cin+X).
 */
const fullAdder: Circuit = {
  nodes: [
    n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('Cin', 'IN', 'Cin'),
    n('g1', 'NAND'), n('g2', 'OR'), n('g3', 'NAND'), n('g4', 'NAND'), n('g5', 'NAND'), n('g6', 'NAND'), n('g7', 'OR'), n('g8', 'NAND'),
    n('Cout', 'OUT', 'Cout'), n('S', 'OUT', 'S'),
  ],
  wires: [
    w('A', 'g1', 0), w('B', 'g1', 1),
    w('A', 'g2', 0), w('B', 'g2', 1),
    w('Cin', 'g3', 0), w('g2', 'g3', 1),
    w('g1', 'g4', 0), w('g2', 'g4', 1),
    w('g1', 'g5', 0), w('g3', 'g5', 1),
    w('Cin', 'g6', 0), w('g4', 'g6', 1),
    w('Cin', 'g7', 0), w('g4', 'g7', 1),
    w('g6', 'g8', 0), w('g7', 'g8', 1),
    w('g5', 'Cout'), w('g8', 'S'),
  ],
}

/** Ripple-carry chain of `bits` FA chips. FA pins: in A=0, B=1, Cin=2; out Cout=0, S=1. */
function rippleAdder(bits: number): Circuit {
  const nodes: Node[] = []
  const wires: Wire[] = []
  for (let i = 0; i < bits; i++) nodes.push(n(`A${i}`, 'IN', `A${i}`))
  for (let i = 0; i < bits; i++) nodes.push(n(`B${i}`, 'IN', `B${i}`))
  nodes.push(n('Cin', 'IN', 'Cin'))
  for (let i = 0; i < bits; i++) {
    nodes.push(n(`f${i}`, { chip: 'FA' }))
    wires.push(w(`A${i}`, `f${i}`, 0), w(`B${i}`, `f${i}`, 1), w(i === 0 ? 'Cin' : `f${i - 1}`, `f${i}`, 2, 0))
  }
  nodes.push(n('Cout', 'OUT', 'Cout'))
  wires.push(w(`f${bits - 1}`, 'Cout', 0, 0))
  for (let i = 0; i < bits; i++) {
    nodes.push(n(`S${i}`, 'OUT', `S${i}`))
    wires.push(w(`f${i}`, `S${i}`, 0, 1))
  }
  return { nodes, wires }
}

/** Truth table of an n-bit adder, columns in alphabetical order: A0..A(n-1), B0..B(n-1), Cin -> Cout, S0..S(n-1). */
function adderSpec(bits: number) {
  const inputs = [...Array.from({ length: bits }, (_, i) => `A${i}`), ...Array.from({ length: bits }, (_, i) => `B${i}`), 'Cin']
  const outputs = ['Cout', ...Array.from({ length: bits }, (_, i) => `S${i}`)]
  const rows: Out[][] = []
  for (let r = 0; r < 1 << inputs.length; r++) {
    const bit = (name: string) => (r >> (inputs.length - 1 - inputs.indexOf(name))) & 1
    let a = 0, b = 0
    for (let i = 0; i < bits; i++) { a |= bit(`A${i}`) << i; b |= bit(`B${i}`) << i }
    const sum = a + b + bit('Cin')
    rows.push([((sum >> bits) & 1) as Out, ...Array.from({ length: bits }, (_, i) => ((sum >> i) & 1) as Out)])
  }
  return { inputs, outputs, rows }
}

/** Adder/subtractor: XOR(B_i, M) into FA chips, C0 = M, V = C(n) xor C(n-1). FA 100 ns, XOR 75 ns, M ideal. */
export function adderSubtractor(bits: number): Circuit {
  const nodes: Node[] = [n('M', 'IN', 'M')]
  const wires: Wire[] = []
  for (let i = 0; i < bits; i++) {
    nodes.push(n(`A${i}`, 'IN', `A${i}`), n(`B${i}`, 'IN', `B${i}`), n(`x${i}`, 'XOR', undefined, 75), n(`f${i}`, { chip: 'FA' }, undefined, 100), n(`S${i}`, 'OUT', `S${i}`))
    wires.push(
      w(`B${i}`, `x${i}`, 0), w('M', `x${i}`, 1),
      w(`A${i}`, `f${i}`, 0), w(`x${i}`, `f${i}`, 1), w(i === 0 ? 'M' : `f${i - 1}`, `f${i}`, 2, 0),
      w(`f${i}`, `S${i}`, 0, 1),
    )
  }
  const last = `f${bits - 1}`
  nodes.push(n('C', 'OUT', 'C'), n('xv', 'XOR', undefined, 75), n('V', 'OUT', 'V'))
  wires.push(w(last, 'C', 0, 0), w(`f${bits - 2}`, 'xv', 0, 0), w(last, 'xv', 1, 0), w('xv', 'V'))
  return { nodes, wires }
}

export const stage5: Stage = {
  id: 'sw-5-blocks', order: 5, title: 'אבני בניין צירופיות',
  rooms: [
    {
      id: 'sw-5-r1', title: 'השהיה במסלול הקריטי',
      intro: 'בשער NAND השהיה של 2 יחידות ובשער NOT השהיה של 1. מהו זמן ההגעה הגרוע ביותר ביציאה F?',
      puzzle: {
        type: 'delay',
        circuit: {
          nodes: [n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('g1', 'NAND', undefined, 2), n('g2', 'NOT', undefined, 1), n('F', 'OUT', 'F')],
          wires: [w('A', 'g1', 0), w('B', 'g1', 1), w('g1', 'g2'), w('g2', 'F')],
        },
        askAt: 'F', answer: 3,
      },
      hints: [{ text: 'סכמו את ההשהיות לאורך המסלול הארוך ביותר מכניסה ליציאה.' }],
    },
    {
      id: 'sw-5-r2', title: 'מרבב 2×1',
      intro: 'מרבב (MUX) בוחר בין שתי כניסות נתונים לפי קו הבחירה: כש-S = 0 היציאה Y = I0, וכש-S = 1 היציאה Y = I1. בנו אותו משערים.',
      puzzle: {
        type: 'circuit',
        spec: { inputs: ['I0', 'I1', 'S'], outputs: ['Y'], rows: [[0], [0], [0], [1], [1], [0], [1], [1]] },
        allowed: ['AND', 'OR', 'NOT'], optimalGates: 4, reference: mux2(),
        unlocksChip: { name: 'MUX2', inputs: ['I0', 'I1', 'S'], outputs: ['Y'] },
      },
      hints: [
        { text: 'כתבו את Y כ-SOP: איבר אחד לכל ערך של S.' },
        { text: 'Y = S\'·I0 + S·I1.' },
        { text: 'מהפך אחד ל-S, שני AND ו-OR אחד.' },
      ],
    },
    {
      id: 'sw-5-r3', title: 'המהפך שמאט',
      intro: 'זה המרבב שבניתם, עם השהיות: NOT 5 ns, AND 10 ns, OR 10 ns. מה ה-TPD ביציאה Y?',
      puzzle: { type: 'delay', circuit: mux2({ not: 5, and: 10, or: 10 }), askAt: 'Y', answer: 25 },
      hints: [
        { text: 'יש שלושה מסלולים: מ-I0, מ-I1 ומ-S. איזה מהם עובר דרך הכי הרבה שערים?' },
        { text: 'S עובר דרך המהפך, ואחריו AND ו-OR.' },
      ],
    },
    {
      id: 'sw-5-r4', title: 'עץ מרבבים',
      intro: 'צריך MUX 128×1, ובמחסן יש רק רכיבי MUX 4×1. מותר להשאיר כניסות לא מנוצלות. כמה רכיבים נדרשים בסך הכול?',
      puzzle: { type: 'number', prompt: 'מספר רכיבי MUX 4×1 הנדרשים', answer: '43', check: 'numeric', compute: () => String(muxTree(128, 4).total) },
      hints: [
        { text: 'בנו את העץ בשכבות: כל רכיב בשכבה הראשונה בוחר אחת מארבע כניסות נתונים.' },
        { text: 'שכבה ראשונה: 128 / 4 = 32 רכיבים. ממשיכים עם 32 היציאות שלהם.' },
        { text: '32 → 8 → 2 → 1. ברכיב האחרון רק שתי כניסות בשימוש.' },
      ],
    },
    {
      id: 'sw-5-r5', title: 'מחבר מלא',
      intro: 'מחבר מלא (FA) מחבר שלושה ביטים: A, B ונשא נכנס Cin. הדרך הקלאסית: שני HA ושער OR (11 שערים). לשלושה כוכבים צריך פחות.',
      puzzle: {
        type: 'circuit',
        spec: { inputs: ['A', 'B', 'Cin'], outputs: ['Cout', 'S'], rows: [[0, 0], [0, 1], [0, 1], [1, 0], [0, 1], [1, 0], [1, 0], [1, 1]] },
        allowed: ['NAND', 'OR'], optimalGates: 8, reference: fullAdder,
        unlocksChip: { name: 'FA', inputs: ['A', 'B', 'Cin'], outputs: ['Cout', 'S'] },
      },
      hints: [
        { text: 'התחילו מ-HA(A,B), אחריו HA(S₁,Cin), ו-Cout = C₁ + C₂. זה עובד, אבל עולה 11 שערים.' },
        { text: 'לחיסכון: Cout = AB + Cin(A + B). יש OR מוכן, ו-NAND(NAND(A,B), NAND(Cin, A+B)) נותן בדיוק את זה.' },
        { text: 'X = NAND(NAND(A,B), A+B) הוא XNOR(A,B). באותו טריק: S = NAND(NAND(Cin,X), Cin+X). סך הכול 8 שערים.' },
      ],
    },
    {
      id: 'sw-5-r6', title: 'מחבר 4 ביטים',
      intro: 'שרשרו ארבעה מחברים מלאים למחבר אדווה (Ripple Carry) של 4 ביטים: הנשא היוצא מכל שלב נכנס לשלב הבא.',
      puzzle: {
        type: 'circuit', spec: adderSpec(4), allowed: ['NAND', 'OR'], optimalGates: 32, reference: rippleAdder(4),
        unlocksChip: { name: 'ADD4', inputs: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Cin'], outputs: ['Cout', 'S0', 'S1', 'S2', 'S3'] },
      },
      hints: [
        { text: 'כל FA מקבל A_i ו-B_i. ל-FA הראשון נכנס Cin.' },
        { text: 'חברו את Cout של שלב i לכניסת Cin של שלב i+1, ואת Cout של השלב האחרון ליציאה Cout.' },
        { text: 'לשלושה כוכבים השתמשו ב-FA של 8 שערים: 4 · 8 = 32.' },
      ],
    },
    {
      id: 'sw-5-r7', title: 'מחבר בתוך ROM',
      intro: 'במקום שערים, אפשר לשמור את כל טבלת האמת של ADD4 בזיכרון ROM. כל צירוף כניסה הוא כתובת, וכל מילה מכילה את היציאות.',
      puzzle: { type: 'number', prompt: 'כמה ביטים צריך ה-ROM להכיל?', answer: '2560', check: 'numeric', compute: () => String(romBits(9, 5)) },
      hints: [
        { text: 'ספרו כניסות: הן קווי הכתובת. ספרו יציאות: הן רוחב המילה.' },
        { text: '9 קווי כתובת (A0–A3, B0–B3, Cin) ו-5 יציאות (S0–S3, Cout).' },
        { text: 'גודל = 2⁹ מילים · 5 ביטים.' },
      ],
    },
    {
      id: 'sw-5-r8', title: 'מחבר/מחסר: גלישה',
      intro: 'מחבר/מחסר של 3 ביטים: שער XOR (75 ns) הופך את B_i כש-M = 1, ו-M נכנס גם כנשא הראשון. כל FA הוא 100 ns מכל כניסה לכל יציאה, ו-M כניסה אידיאלית ללא השהיה. V = C₃ ⊕ C₂ מזהה גלישה.',
      puzzle: { type: 'delay', circuit: adderSubtractor(3), askAt: 'V', answer: 450 },
      hints: [
        { text: 'כניסות ה-B עוברות XOR לפני ה-FA הראשון, ולכן הוא מתחיל לעבוד רק ב-75 ns.' },
        { text: 'הנשא מתגלגל: כל FA מוסיף 100 ns. C₃ מוכן ב-75 + 3·100.' },
        { text: 'V הוא XOR נוסף על C₃: עוד 75 ns.' },
      ],
    },
  ],
  cards: cards5,
}
