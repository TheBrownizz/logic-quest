/**
 * A tiny parser that exists only in tests: it evaluates the display strings of the lessons ("(A+B)·C'", "A⊕B") so the
 * tests can cross-check each expression's `fn` against the way it is written. Precedence: ' (NOT) > · (AND) > + (OR) > ⊕ (XOR).
 */
export type Env = Record<string, 0 | 1>

export function evalDisplay(src: string, env: Env): 0 | 1 {
  const s = src.replace(/[\s⁦⁩ ]/g, '')
  let i = 0
  const peek = () => s[i]
  const xor = (): 0 | 1 => {
    let v = or()
    while (peek() === '⊕') { i++; v = (v ^ or()) as 0 | 1 }
    return v
  }
  const or = (): 0 | 1 => {
    let v = and()
    while (peek() === '+') { i++; const r = and(); v = (v | r) as 0 | 1 }
    return v
  }
  const and = (): 0 | 1 => {
    let v = not()
    while (peek() === '·') { i++; const r = not(); v = (v & r) as 0 | 1 }
    return v
  }
  const not = (): 0 | 1 => {
    let v = atom()
    while (peek() === "'") { i++; v = v ? 0 : 1 }
    return v
  }
  const atom = (): 0 | 1 => {
    const c = s[i]
    if (c === '(') { i++; const v = xor(); if (s[i++] !== ')') throw new Error(`expected ) in ${src}`); return v }
    if (c === '0' || c === '1') { i++; return Number(c) as 0 | 1 }
    if (/[A-Z]/.test(c ?? '')) { i++; const v = env[c]; if (v === undefined) throw new Error(`unbound ${c} in ${src}`); return v }
    throw new Error(`unexpected "${c}" at ${i} in ${src}`)
  }
  const v = xor()
  if (i !== s.length) throw new Error(`trailing input at ${i} in ${src}`)
  return v
}

/** Truth-table column of a display string over `vars` (row 0 first, vars[0] most significant). */
export function columnOfDisplay(src: string, vars: string[]): (0 | 1)[] {
  return Array.from({ length: 1 << vars.length }, (_, r) =>
    evalDisplay(src, Object.fromEntries(vars.map((v, k) => [v, ((r >> (vars.length - 1 - k)) & 1) as 0 | 1]))))
}

/** Are two display strings equivalent over `vars`? */
export const sameDisplay = (a: string, b: string, vars: string[]) =>
  columnOfDisplay(a, vars).join('') === columnOfDisplay(b, vars).join('')
