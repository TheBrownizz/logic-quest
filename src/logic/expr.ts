import type { Bit } from './boolean'

/**
 * A small Boolean expression parser for typed answers and content equations.
 *
 * Grammar (loosest first):
 *   or   := xor ('+' xor)*
 *   xor  := and (('⊕' | '^') and)*
 *   and  := not (('·' | '*' | '&')? not)*      juxtaposition is AND: "AB'X"
 *   not  := ('!' | '~' | '¬') not | atom ("'" | '’' | '′')*
 *   atom := variable | '0' | '1' | '(' or ')'
 *
 * Variables are matched against the given names, longest first, so "Q1Q0" reads as Q1·Q0. Case is ignored
 * when that is unambiguous. A leading "name =" (e.g. "DA = A'X") is dropped.
 */

export type Env = Record<string, Bit>
type Ast =
  | { k: 'var'; name: string }
  | { k: 'const'; v: Bit }
  | { k: 'not'; a: Ast }
  | { k: 'and' | 'or' | 'xor'; a: Ast; b: Ast }

export interface ParsedExpr {
  ok: true
  /** The value under an assignment of every variable. */
  eval: (env: Env) => Bit
  /** Variable occurrences (the literal count of an SOP). */
  literals: number
  /** The variables that occur, in the order of `vars`. */
  uses: string[]
  /**
   * Written as a sum of products: an OR of AND-terms whose factors are variables, complemented variables or
   * constants (no ⊕, no complemented or parenthesised sums inside a product). Parentheses that only group a
   * term are fine.
   */
  sop: boolean
}
export type ParseResult = ParsedExpr | { ok: false; error: string; at: number }

const NOT_POST = new Set(["'", '’', '′'])
const NOT_PRE = new Set(['!', '~', '¬'])
const AND_OPS = new Set(['·', '*', '&', '•', '⋅'])
const XOR_OPS = new Set(['⊕', '^'])

export function parseExpr(text: string, vars: readonly string[]): ParseResult {
  let src = text
  const eq = src.lastIndexOf('=')
  if (eq >= 0) src = src.slice(eq + 1)
  const s = src.replace(/\s+/g, '')
  if (s === '') return { ok: false, error: 'empty', at: 0 }
  const names = [...vars].sort((a, b) => b.length - a.length)
  const lower = new Map<string, string[]>()
  for (const v of vars) lower.set(v.toLowerCase(), [...(lower.get(v.toLowerCase()) ?? []), v])
  let i = 0
  let literals = 0
  const used = new Set<string>()

  class Fail extends Error { constructor(m: string, public at: number) { super(m) } }
  const peek = () => s[i]

  const matchVar = (): string | null => {
    for (const n of names) if (s.startsWith(n, i)) return n
    for (const n of names) {
      const cand = s.slice(i, i + n.length).toLowerCase()
      const hits = lower.get(cand)
      if (cand === n.toLowerCase() && hits && hits.length === 1) return hits[0]
    }
    return null
  }

  const atom = (): Ast => {
    const c = peek()
    if (c === undefined) throw new Fail('unexpected end', i)
    if (c === '(') {
      i++
      const e = or()
      if (peek() !== ')') throw new Fail('missing )', i)
      i++
      return e
    }
    const v = matchVar()
    if (v) {
      i += v.length
      literals++
      used.add(v)
      return { k: 'var', name: v }
    }
    if (c === '0' || c === '1') { i++; return { k: 'const', v: c === '1' ? 1 : 0 } }
    throw new Fail(`unexpected "${c}"`, i)
  }
  const not = (): Ast => {
    if (NOT_PRE.has(peek())) { i++; return { k: 'not', a: not() } }
    let a = atom()
    while (NOT_POST.has(peek())) { i++; a = { k: 'not', a } }
    return a
  }
  const startsFactor = () => {
    const c = peek()
    return c !== undefined && (c === '(' || NOT_PRE.has(c) || c === '0' || c === '1' || matchVar() !== null)
  }
  const and = (): Ast => {
    let a = not()
    for (;;) {
      if (AND_OPS.has(peek())) { i++; a = { k: 'and', a, b: not() }; continue }
      if (startsFactor()) { a = { k: 'and', a, b: not() }; continue }
      return a
    }
  }
  const xor = (): Ast => {
    let a = and()
    while (XOR_OPS.has(peek())) { i++; a = { k: 'xor', a, b: and() } }
    return a
  }
  const or = (): Ast => {
    let a = xor()
    while (peek() === '+') { i++; a = { k: 'or', a, b: xor() } }
    return a
  }

  let ast: Ast
  try {
    ast = or()
    if (i < s.length) throw new Fail(`unexpected "${s[i]}"`, i)
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message, at: e.at }
    throw e
  }
  const ev = (n: Ast, env: Env): Bit => {
    switch (n.k) {
      case 'var': return env[n.name] ?? 0
      case 'const': return n.v
      case 'not': return (ev(n.a, env) ^ 1) as Bit
      case 'and': return (ev(n.a, env) & ev(n.b, env)) as Bit
      case 'or': return (ev(n.a, env) | ev(n.b, env)) as Bit
      case 'xor': return (ev(n.a, env) ^ ev(n.b, env)) as Bit
    }
  }
  const isLit = (n: Ast): boolean => n.k === 'var' || n.k === 'const' || (n.k === 'not' && (n.a.k === 'var' || n.a.k === 'const'))
  const isTerm = (n: Ast): boolean => isLit(n) || (n.k === 'and' && isTerm(n.a) && isTerm(n.b))
  const isSop = (n: Ast): boolean => isTerm(n) || (n.k === 'or' && isSop(n.a) && isSop(n.b))
  return { ok: true, eval: env => ev(ast, env), literals, uses: vars.filter(v => used.has(v)), sop: isSop(ast) }
}

/** The assignment of row `index` over `vars` (vars[0] is the MSB). */
export function envOf(vars: readonly string[], index: number): Env {
  const env: Env = {}
  vars.forEach((n, j) => { env[n] = ((index >> (vars.length - 1 - j)) & 1) as Bit })
  return env
}

/** The minterms (row indices, vars[0] the MSB) where `e` is 1. */
export function mintermsOf(e: ParsedExpr, vars: readonly string[]): number[] {
  const out: number[] = []
  for (let m = 0; m < 1 << vars.length; m++) if (e.eval(envOf(vars, m))) out.push(m)
  return out
}
