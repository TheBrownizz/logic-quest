const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function checkBase(base: number): void {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new RangeError(`Invalid base: ${base}`)
  }
}

function digitOf(ch: string): number {
  return ALPHABET.indexOf(ch.toUpperCase())
}

/** Integer to string in given base (digits 0-9A-Z). */
export function toBase(n: number, base: number): string {
  checkBase(base)
  if (!Number.isInteger(n)) throw new RangeError(`Not an integer: ${n}`)
  if (n === 0) return '0'
  const neg = n < 0
  let v = Math.abs(n)
  let out = ''
  while (v > 0) {
    out = ALPHABET[v % base] + out
    v = Math.floor(v / base)
  }
  return neg ? '-' + out : out
}

/** True if every digit is a legal digit of the base. */
export function isValidIn(digits: string, base: number): boolean {
  if (digits.length === 0) return false
  for (const ch of digits) {
    const d = digitOf(ch)
    if (d < 0 || d >= base) return false
  }
  return true
}

/** Parse digits in base; throws on a digit >= base. */
export function fromBase(digits: string, base: number): number {
  checkBase(base)
  if (!isValidIn(digits, base)) {
    throw new Error(`Invalid digit in "${digits}" for base ${base}`)
  }
  let v = 0
  for (const ch of digits) v = v * base + digitOf(ch)
  return v
}

/** Positional value of digits in radix r, without validating digits. */
export function digitsValue(digits: string, r: number): number {
  let v = 0
  for (const ch of digits) v = v * r + digitOf(ch)
  return v
}

/** All bases in [min, max] where lhs(r) === rhs(r). */
export function findBases(
  lhs: (r: number) => number,
  rhs: (r: number) => number,
  min = 2,
  max = 36,
): number[] {
  const out: number[] = []
  for (let r = min; r <= max; r++) if (lhs(r) === rhs(r)) out.push(r)
  return out
}

/** (r-1)'s complement, fixed width = digits.length. */
export function complementR1(digits: string, base: number): string {
  checkBase(base)
  if (!isValidIn(digits, base)) throw new Error(`Invalid digits "${digits}" for base ${base}`)
  return [...digits].map(ch => ALPHABET[base - 1 - digitOf(ch)]).join('')
}

/** r's complement, fixed width = digits.length (wraps mod base^width). */
export function complementR(digits: string, base: number): string {
  const c1 = complementR1(digits, base)
  const chars = [...c1]
  let i = chars.length - 1
  for (; i >= 0; i--) {
    const d = digitOf(chars[i]) + 1
    if (d < base) {
      chars[i] = ALPHABET[d]
      break
    }
    chars[i] = '0'
  }
  return chars.join('')
}

export function encodeIEEE754(x: number): { sign: 0 | 1; exponent: number; mantissa: number; bits: string } {
  const dv = new DataView(new ArrayBuffer(4))
  dv.setFloat32(0, x)
  const u = dv.getUint32(0)
  const bits = u.toString(2).padStart(32, '0')
  return {
    sign: (u >>> 31) as 0 | 1,
    exponent: (u >>> 23) & 0xff,
    mantissa: u & 0x7fffff,
    bits,
  }
}

export function decodeIEEE754(bits: string): number {
  if (!/^[01]{32}$/.test(bits)) throw new Error('Expected 32 binary digits')
  const dv = new DataView(new ArrayBuffer(4))
  dv.setUint32(0, parseInt(bits, 2) >>> 0)
  return dv.getFloat32(0)
}
