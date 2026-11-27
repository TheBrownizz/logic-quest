/**
 * Answer normalisation shared by the validator (compute() against answer) and the lesson player (typed answer
 * against answer): no whitespace, upper case, and a Unicode minus (−) read as '-'.
 */
export const normalizeAnswer = (s: string): string => s.replace(/\s+/g, '').replace(/−/g, '-').toUpperCase()

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/

/**
 * A typed answer against the expected one: equal after normalizeAnswer, or, when the expected answer reads as a
 * decimal number (it has a sign, a point or a digit 2–9), equal in value. A bit string such as "101" is compared
 * as text, so "0101" is not accepted for it.
 */
export function matchesAnswer(given: string, answer: string): boolean {
  const g = normalizeAnswer(given)
  const a = normalizeAnswer(answer)
  if (g === '') return false
  if (g === a) return true
  const decimal = DECIMAL.test(a) && /[+\-.2-9]/.test(a)
  if (!decimal || !DECIMAL.test(g)) return false
  return Math.abs(Number(g) - Number(a)) <= 1e-9
}
