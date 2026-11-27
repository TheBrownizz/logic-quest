import type { Stage } from '../types'
import { complementR, decodeIEEE754, encodeIEEE754, fromBase, toBase } from '../../logic/numbers'
import { evenParityBit, toGray } from '../../logic/codes'
import { cards2 } from './stage2-cards'
import { ltr } from './helpers'

/**
 * The invented "MX" code, exactly as its definition reads: for b_n…b_0 (b_n = MSB),
 * q_n = b_n'  and  q_i = (b_i xor b_(i+1))·b_n' + b_i·b_n  for 0 ≤ i < n.
 */
export function encodeMX(bits: string): string {
  if (!/^[01]{2,}$/.test(bits)) throw new Error(`Expected at least 2 bits, got "${bits}"`)
  const n = bits.length - 1
  const b = (i: number) => Number(bits[n - i]) // b(n) is the leftmost character
  const not = (x: number) => 1 - x
  const q: number[] = []
  q[n] = not(b(n))
  for (let i = 0; i < n; i++) q[i] = ((b(i) ^ b(i + 1)) & not(b(n))) | (b(i) & b(n))
  let out = ''
  for (let i = n; i >= 0; i--) out += q[i]
  return out
}

export const stage2: Stage = {
  id: 'sw-2-arith', order: 2, title: 'אריתמטיקה, IEEE וקודים',
  rooms: [
    {
      id: 'sw-2-r1', title: 'משלים ל-2',
      intro: 'מצאו את המשלים ל-2 של 00101101 ברוחב 8 ביטים.',
      puzzle: { type: 'number', prompt: 'כתבו את המשלים ל-2 של 00101101 (8 ביטים)', answer: '11010011', check: 'exact', compute: () => complementR('00101101', 2) },
      hints: [
        { text: 'הפכו כל ביט והוסיפו 1.' },
        { text: 'קיצור: העתיקו מימין עד ה-1 הראשון כולל, והפכו את כל השאר.' },
      ],
    },
    {
      id: 'sw-2-r2', title: 'חיבור עם נשא',
      intro: 'חברו את שני המספרים הבינאריים (ללא סימן) 10110110 ו-01101101. שימו לב: התוצאה רחבה יותר משמונה ביטים.',
      puzzle: {
        type: 'number', prompt: `כתבו את הסכום ${ltr('10110110 + 01101101')} בבינארי`, answer: '100100011', check: 'exact',
        compute: () => toBase(fromBase('10110110', 2) + fromBase('01101101', 2), 2),
      },
      hints: [
        { text: `חברו עמודה-עמודה מימין: ${ltr('1 + 1 = 10')}, כלומר כותבים 0 ומעבירים נשא 1.` },
        { text: `בדיקה בעשרוני: ${ltr('182 + 109 = 291')}. הנשא מהעמודה השמאלית הופך לביט התשיעי.` },
      ],
    },
    {
      id: 'sw-2-r3', title: 'המעריך המוסט',
      intro: `ב-IEEE-754 (32 ביט) המעריך נשמר בתוספת היסט ${ltr('(bias)')} של 127. מה תוכן 8 ביטי המעריך בייצוג של 12.5?`,
      puzzle: {
        type: 'number', prompt: 'כתבו את שדה המעריך של 12.5 (8 ביטים)', answer: '10000010', check: 'exact',
        compute: () => toBase(encodeIEEE754(12.5).exponent, 2).padStart(8, '0'),
      },
      hints: [
        { text: `כתבו את 12.5 בבינארי ונרמלו לצורה ${ltr('1.xxx · 2^e')}.` },
        { text: `${ltr('12.5 = 1100.1 = 1.1001 · 2³')}, כלומר ${ltr('e = 3')}.` },
        { text: `השדה הוא ${ltr('e + 127 = 130')} בבינארי, ב-8 ביטים.` },
      ],
    },
    {
      id: 'sw-2-r4', title: 'מילה מלאה ב-32 ביטים',
      intro: `עכשיו כל המילה: כתבו את ${ltr('−6.75')} בפורמט IEEE-754 (32 ביט), כשמונה ספרות הקסדצימליות.`,
      puzzle: {
        type: 'number', prompt: `כתבו את ${ltr('−6.75')} ב-IEEE-754 בהקסדצימלי (8 ספרות)`, answer: 'C0D80000', check: 'exact',
        compute: () => toBase(fromBase(encodeIEEE754(-6.75).bits, 2), 16).padStart(8, '0'),
      },
      hints: [
        { text: `סימן 1 כי המספר שלילי. ${ltr('6.75 = 110.11')} בבינארי.` },
        { text: `${ltr('110.11 = 1.1011 · 2²')}, ולכן המעריך הוא ${ltr('129 = 10000001')}, והמנטיסה (בלי הביט החבוי) היא 1011 ואחריה אפסים.` },
        { text: `חברו ${ltr('1 | 10000001 | 1011000…')} וחלקו לרביעיות: ${ltr('1100 0000 1101 1000')} ואחריהן אפסים.` },
      ],
    },
    {
      id: 'sw-2-r5', title: 'פענוח לאחור',
      intro: 'מילת IEEE-754 (32 ביט) היא 41340000 בהקסדצימלי. איזה מספר עשרוני היא מייצגת?',
      puzzle: {
        type: 'number', prompt: 'כתבו את הערך העשרוני של 0x41340000', answer: '11.25', check: 'numeric',
        compute: () => String(decodeIEEE754(toBase(fromBase('41340000', 16), 2).padStart(32, '0'))),
      },
      hints: [
        { text: `פרשו לבינארי: ${ltr('0100 0001 0011 0100 0000…')}` },
        { text: `סימן 0; מעריך ${ltr('10000010 = 130')}, כלומר 2³; מנטיסה 0110100…` },
        { text: `הוסיפו את הביט החבוי: ${ltr('1.01101 · 2³ = 1011.01')}.` },
      ],
    },
    {
      id: 'sw-2-r6', title: 'ביט זוגיות',
      intro: `משדר מוסיף בסוף כל מילה ביט זוגיות זוגית ${ltr('(Even Parity)')}, כך שמספר האחדות במילה המשודרת זוגי. מה משודר עבור כל מילה?`,
      puzzle: {
        type: 'code',
        definition: `זוגיות זוגית: מילת הקוד היא מילת הקלט ואחריה ביט P.\n${ltr('P = 1')} אם מספר האחדות בקלט אי-זוגי, אחרת ${ltr('P = 0')}.`,
        encode: bits => bits + evenParityBit(bits),
        inputs: ['1011001', '0110100', '1111111'],
      },
      hints: [
        { text: 'ספרו את האחדות בכל מילה.' },
        { text: `ב-1011001 יש 4 אחדות, ולכן ${ltr('P = 0')}. ב-1111111 יש 7, ולכן ${ltr('P = 1')}.` },
      ],
    },
    {
      id: 'sw-2-r7', title: 'קוד גריי',
      intro: 'בקוד גריי שני ערכים עוקבים נבדלים בביט אחד בלבד. המירו כל מילה בינארית לקוד גריי.',
      puzzle: {
        type: 'code',
        definition: `קוד גריי: עבור b3b2b1b0 (b3 הוא ה-MSB):\n${ltr('g3 = b3')}\n${ltr('g_i = b_i ⊕ b_(i+1)')}   לכל ${ltr('0 ≤ i ≤ 2')}`,
        encode: toGray,
        inputs: ['0111', '1010', '1101'],
      },
      hints: [
        { text: 'הביט השמאלי מועתק כמו שהוא.' },
        { text: `כל ביט אחר הוא XOR של הביט באותו מקום והביט שמשמאלו. למשל ${ltr('0111 → 0100')}.` },
      ],
    },
    {
      id: 'sw-2-r8', title: 'קוד MX',
      intro: 'מהנדסת המציאה קוד חדש שמשלב את רעיון גריי עם בקרה של הביט העליון. פעלו אך ורק לפי ההגדרה.',
      puzzle: {
        type: 'code',
        definition: `קוד MX (מומצא, לא סטנדרטי): לכל מילה b4b3b2b1b0 (b4 הוא ה-MSB) מילת הקוד היא q4q3q2q1q0:\n${ltr("q4 = b4'")}\n${ltr("q_i = (b_i ⊕ b_(i+1))·b4' + b_i·b4")}   לכל ${ltr('0 ≤ i ≤ 3')}`,
        encode: encodeMX,
        inputs: ['01101', '10110', '00111', '11001'],
      },
      hints: [
        { text: 'התחילו מ-q4: הוא פשוט ההפך של b4.' },
        { text: `הביטוי של ${ltr('q_i')} הוא בורר: כש-${ltr('b4 = 0')} נשאר ${ltr('b_i ⊕ b_(i+1)')}, וכש-${ltr('b4 = 1')} נשאר ${ltr('b_i')}.` },
        { text: `עבור 01101: ${ltr('b4 = 0')}, ולכן ${ltr('q4 = 1')} ואחריו XOR של זוגות סמוכים: ${ltr('1⊕0, 1⊕1, 0⊕1, 1⊕0')}.` },
      ],
    },
  ],
  cards: cards2,
}
