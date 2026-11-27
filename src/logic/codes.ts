function checkBits(bits: string): void {
  if (!/^[01]+$/.test(bits)) throw new Error(`Expected binary digits, got "${bits}"`)
}

/** Binary-reflected Gray code of a bit string (same width): g_i = b_i xor b_(i+1), MSB copied. */
export function toGray(bits: string): string {
  checkBits(bits)
  return [...bits].map((b, i) => (i === 0 ? b : String(Number(b) ^ Number(bits[i - 1])))).join('')
}

/** Inverse of toGray: b_i = g_i xor b_(i+1). */
export function fromGray(gray: string): string {
  checkBits(gray)
  let prev = 0
  return [...gray].map(g => String((prev ^= Number(g)))).join('')
}

/** The even-parity bit: 1 when the number of 1s is odd, so the total becomes even. */
export function evenParityBit(bits: string): '0' | '1' {
  checkBits(bits)
  return [...bits].filter(b => b === '1').length % 2 === 1 ? '1' : '0'
}

/** BCD (8421) of a non-negative decimal integer, one 4-bit group per digit, groups separated by a space. */
export function toBCD(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Not a non-negative integer: ${n}`)
  return [...String(n)].map(d => Number(d).toString(2).padStart(4, '0')).join(' ')
}
