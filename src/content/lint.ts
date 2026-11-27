/**
 * Text lint for user-visible content strings (rooms, cards, lessons). Hebrew renders right to left, so
 * formulas, negative numbers and spaced bit groups inside Hebrew text must sit in LTR isolates (ltr() in
 * src/content/switching/helpers.ts). Strings with no Hebrew render LTR (see Prose) and are not checked.
 */

const HEB = /[֐-׿]/
const dropIsolates = (s: string, by = '') => s.replace(/⁦[^⁩]*⁩/g, by)

/** Minus signs next to digits must sit inside LTR isolates (U+2066…U+2069), or RTL text flips them. */
export function looseMinus(text: string): boolean {
  const t = dropIsolates(text)
  return /(^|[\s(])[-−]\d/.test(t) || /\d[-−](?=$|[\s,.;:)])/.test(t) || /[֐-׿-]−\d/.test(t)
}

/**
 * A formula character touching (spaces allowed) a Latin letter or a digit outside an isolate, in a Hebrew string.
 * Parentheses around text that contains Hebrew are prose punctuation and are ignored. Returns the offending match.
 */
export function looseFormula(text: string): string | null {
  if (!HEB.test(text)) return null
  let t = dropIsolates(text, ' ').replace(/[A-Za-z]'[a-z]/g, ' ') // drop isolates and English contractions (Don't)
  for (let prev = ''; prev !== t;) { prev = t; t = t.replace(/\(([^()]*)\)/g, (m, inner: string) => (HEB.test(inner) ? `\u0001${inner}\u0002` : m)) }
  const ALNUM = 'A-Za-z0-9²³¹⁰-⁹₀-₉'
  const OP = "=+·⊕'≤≥<>^_Σ()−→×≠"
  const m = new RegExp(`[${ALNUM}] *[${OP}]|[${OP}] *[${ALNUM}]`).exec(t)
  return m ? m[0] : null
}

/**
 * Two or more digit/hex groups separated by spaces, no-break spaces or `|` (bit fields, nibble groups) must sit
 * in one LTR isolate: in RTL text the groups are laid out right to left, i.e. in reverse order.
 */
const GROUP = '[0-9A-F]*[0-9][0-9A-F]*'
const SPACED_GROUPS = new RegExp(`(?<!\\w|\\d\\.)${GROUP}(?:[  ]*\\|[  ]*|[  ]+)${GROUP}(?!\\w|\\.\\d)`)
export function looseGroups(text: string): string | null {
  if (!HEB.test(text)) return null
  const m = SPACED_GROUPS.exec(dropIsolates(text, ' '))
  return m ? m[0] : null
}

/** Every lint problem of one string, as readable messages ([] when clean). */
export function lintText(s: string): string[] {
  const out: string[] = []
  if (looseMinus(s)) out.push('negative number outside an LTR isolate')
  const f = looseFormula(s)
  if (f) out.push(`formula outside an LTR isolate [${f}]`)
  const g = looseGroups(s)
  if (g) out.push(`spaced bit groups outside an LTR isolate [${g}]`)
  return out
}
