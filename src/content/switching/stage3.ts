import type { Circuit, GateKind } from '../../logic/circuit'
import type { Stage } from '../types'
import { node as n, wire as w } from './helpers'
import { cards3 } from './stage3-cards'

/** Half adder from 5 NAND gates: S = A xor B, C = A and B. */
const halfAdderNand: Circuit = {
  nodes: [
    n('A', 'IN', 'A'), n('B', 'IN', 'B'),
    n('n1', 'NAND'), n('n2', 'NAND'), n('n3', 'NAND'), n('n4', 'NAND'), n('n5', 'NAND'),
    n('C', 'OUT', 'C'), n('S', 'OUT', 'S'),
  ],
  wires: [
    w('A', 'n1', 0), w('B', 'n1', 1),
    w('A', 'n2', 0), w('n1', 'n2', 1),
    w('B', 'n3', 0), w('n1', 'n3', 1),
    w('n2', 'n4', 0), w('n3', 'n4', 1),
    w('n1', 'n5', 0), w('n1', 'n5', 1),
    w('n5', 'C'), w('n4', 'S'),
  ],
}

/** Two-input circuit F(A,B) from a list of gates [id, kind, in0, in1?]; the last gate drives F. */
const gates2 = (inputs: string[], gs: [string, GateKind, string, string?][]): Circuit => ({
  nodes: [...inputs.map(i => n(i, 'IN', i)), ...gs.map(([id, k]) => n(id, k)), n('F', 'OUT', 'F')],
  wires: [
    ...gs.flatMap(([id, , a, b]) => (b === undefined ? [w(a, id, 0)] : [w(a, id, 0), w(b, id, 1)])),
    w(gs[gs.length - 1][0], 'F'),
  ],
})

const tt = (inputs: string[], col: (0 | 1)[]) => ({ inputs, outputs: ['F'], rows: col.map(v => [v]) })

export const stage3: Stage = {
  id: 'sw-3-boolean', order: 3, title: 'אלגברה בוליאנית ושערים',
  rooms: [
    {
      id: 'sw-3-r2', title: 'NOT מתוך NAND',
      intro: 'בשלב הזה יש לכם רק שער אחד: NAND. התחילו מהפשוט ביותר, ובנו מהפך (NOT).',
      puzzle: {
        type: 'circuit', spec: tt(['A'], [1, 0]), allowed: ['NAND'], optimalGates: 1,
        reference: gates2(['A'], [['g1', 'NAND', 'A', 'A']]),
      },
      hints: [
        { text: 'מה עושה NAND כששתי הכניסות שלו שוות?' },
        { text: 'חברו את A לשתי הכניסות של אותו שער: NAND(A,A) = (A·A)\' = A\'.' },
      ],
    },
    {
      id: 'sw-3-r3', title: 'AND מתוך NAND',
      intro: 'NAND הוא AND עם היפוך ביציאה. איך מבטלים את ההיפוך? בנו AND משערי NAND בלבד.',
      puzzle: {
        type: 'circuit', spec: tt(['A', 'B'], [0, 0, 0, 1]), allowed: ['NAND'], optimalGates: 2,
        reference: gates2(['A', 'B'], [['g1', 'NAND', 'A', 'B'], ['g2', 'NAND', 'g1', 'g1']]),
      },
      hints: [
        { text: 'השתמשו במהפך שבניתם בחדר הקודם.' },
        { text: 'NAND(A,B) ואחריו NAND שמשמש כמהפך.' },
      ],
    },
    {
      id: 'sw-3-r4', title: 'OR מתוך NAND',
      intro: 'עכשיו OR, עדיין רק עם NAND. כאן נכנס לתמונה דה-מורגן.',
      puzzle: {
        type: 'circuit', spec: tt(['A', 'B'], [0, 1, 1, 1]), allowed: ['NAND'], optimalGates: 3,
        reference: gates2(['A', 'B'], [['g1', 'NAND', 'A', 'A'], ['g2', 'NAND', 'B', 'B'], ['g3', 'NAND', 'g1', 'g2']]),
      },
      hints: [
        { text: 'לפי דה-מורגן: A + B = (A\'·B\')\'.' },
        { text: '(A\'·B\')\' הוא NAND של A\' ו-B\'. מאיפה תביאו את A\' ואת B\'?' },
        { text: 'שני NAND כמהפכים, ו-NAND שלישי שמקבל את שתי היציאות שלהם.' },
      ],
    },
    {
      id: 'sw-3-r5', title: 'דה-מורגן בפעולה',
      intro: 'צריך את F = (A + B)\' (כלומר NOR), אבל במגירה יש רק AND ו-NOT. היעזרו בדה-מורגן.',
      puzzle: {
        type: 'circuit', spec: tt(['A', 'B'], [1, 0, 0, 0]), allowed: ['AND', 'NOT'], optimalGates: 3,
        reference: gates2(['A', 'B'], [['g1', 'NOT', 'A'], ['g2', 'NOT', 'B'], ['g3', 'AND', 'g1', 'g2']]),
      },
      hints: [
        { text: 'מתי F = 1? רק כששתי הכניסות 0.' },
        { text: 'לפי דה-מורגן: (A + B)\' = A\'·B\'.' },
      ],
    },
    {
      id: 'sw-3-r6', title: 'גם NOR אוניברסלי',
      intro: 'NOR הוא שער אוניברסלי כמו NAND. בנו AND משערי NOR בלבד.',
      puzzle: {
        type: 'circuit', spec: tt(['A', 'B'], [0, 0, 0, 1]), allowed: ['NOR'], optimalGates: 3,
        reference: gates2(['A', 'B'], [['g1', 'NOR', 'A', 'A'], ['g2', 'NOR', 'B', 'B'], ['g3', 'NOR', 'g1', 'g2']]),
      },
      hints: [
        { text: 'NOR(A,A) = A\'. מתחילים ממהפכים.' },
        { text: 'דה-מורגן: A·B = (A\' + B\')\', כלומר NOR של A\' ו-B\'.' },
      ],
    },
    {
      id: 'sw-3-r7', title: 'XOR מתוך NAND',
      intro: 'XOR שווה 1 כשהכניסות שונות. אפשר לבנות אותו מ-NAND בלבד, אבל המספר המינימלי של שערים מפתיע.',
      puzzle: {
        type: 'circuit', spec: tt(['A', 'B'], [0, 1, 1, 0]), allowed: ['NAND'], optimalGates: 4,
        reference: gates2(['A', 'B'], [
          ['g1', 'NAND', 'A', 'B'], ['g2', 'NAND', 'A', 'g1'], ['g3', 'NAND', 'B', 'g1'], ['g4', 'NAND', 'g2', 'g3'],
        ]),
      },
      hints: [
        { text: 'הדרך הישירה A\'B + AB\' דורשת 5 שערים. אפשר בארבעה, אם משתפים שער.' },
        { text: 'התחילו מ-g1 = NAND(A,B) והזינו אותו לשני שערים נוספים.' },
        { text: 'g2 = NAND(A, g1), g3 = NAND(B, g1), ו-F = NAND(g2, g3).' },
      ],
    },
    {
      id: 'sw-3-r1', title: 'מחבר למחצה מ-NAND',
      intro: 'בנו מחבר למחצה (Half Adder) באמצעות שערי NAND בלבד. כניסות A,B; יציאות C (נשא) ו-S (סכום).',
      puzzle: {
        type: 'circuit',
        spec: { inputs: ['A', 'B'], outputs: ['C', 'S'], rows: [[0, 0], [0, 1], [0, 1], [1, 0]] },
        allowed: ['NAND'], optimalGates: 5, reference: halfAdderNand,
        unlocksChip: { name: 'HA', inputs: ['A', 'B'], outputs: ['C', 'S'] },
      },
      hints: [
        { text: 'הסכום הוא XOR והנשא הוא AND; את שניהם אפשר לבנות מ-NAND, ושער NAND משותף חוסך שערים.' },
        { text: 'בנו את ה-XOR מהחדר הקודם. השער הראשון שלו, NAND(A,B), הוא בדיוק C\'.' },
        { text: 'הוסיפו NAND אחד כמהפך על NAND(A,B) וקיבלתם C. סך הכול 5 שערים.' },
      ],
    },
  ],
  cards: cards3,
}
