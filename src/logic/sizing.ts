/**
 * A MUX tree of `size`×1 built from k×1 multiplexers: each level selects among ceil(m/k) groups.
 * `partial` counts the multiplexers that have unused data inputs (one per level where m is not a multiple of k).
 */
export function muxTree(size: number, k: number): { total: number; partial: number; levels: number[] } {
  if (!Number.isInteger(size) || size < 2 || !Number.isInteger(k) || k < 2) throw new RangeError('size and k must be integers ≥ 2')
  const levels: number[] = []
  let partial = 0
  for (let m = size; m > 1; m = Math.ceil(m / k)) {
    levels.push(Math.ceil(m / k))
    if (m % k !== 0) partial++
  }
  return { total: levels.reduce((a, b) => a + b, 0), partial, levels }
}

/** Bits in a ROM with `addressBits` address lines and `wordBits` outputs: 2^addressBits words. */
export function romBits(addressBits: number, wordBits: number): number {
  if (!Number.isInteger(addressBits) || addressBits < 0 || !Number.isInteger(wordBits) || wordBits < 1) throw new RangeError('bad ROM size')
  return 2 ** addressBits * wordBits
}
