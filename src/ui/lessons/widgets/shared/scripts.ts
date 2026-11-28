/** Small text helpers shared by the widgets (pure, no React). */

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** A non-negative integer in subscript digits: sub(2) is "₂". */
export const sub = (n: number): string => String(n).split('').map(d => SUB[+d]).join('')

/** A non-negative integer in superscript digits: sup(3) is "³". */
export const sup = (n: number): string => String(n).split('').map(d => SUP[+d]).join('')

/** The character of a digit value: 0-9, then A-F. */
export const digitChar = (d: number): string => d.toString(16).toUpperCase()
