import { describe, expect, it } from 'vitest'
import { evenParityBit, fromGray, toBCD, toGray } from '../../src/logic/codes'
import { muxTree, romBits } from '../../src/logic/sizing'

describe('codes', () => {
  it('Gray code', () => {
    expect(toGray('0110')).toBe('0101')
    expect(toGray('1011')).toBe('1110')
    expect(toGray('0000')).toBe('0000')
    for (let i = 0; i < 16; i++) {
      const b = i.toString(2).padStart(4, '0')
      expect(fromGray(toGray(b))).toBe(b)
      const next = ((i + 1) % 16).toString(2).padStart(4, '0')
      const diff = [...toGray(b)].filter((c, j) => c !== toGray(next)[j]).length
      expect(diff).toBe(1)
    }
    expect(() => toGray('012')).toThrow()
  })
  it('even parity', () => {
    expect(evenParityBit('1011001')).toBe('0')
    expect(evenParityBit('0110100')).toBe('1')
    expect(evenParityBit('1111111')).toBe('1')
  })
  it('BCD', () => {
    expect(toBCD(59)).toBe('0101 1001')
    expect(toBCD(739)).toBe('0111 0011 1001')
  })
})

describe('sizing', () => {
  it('MUX trees', () => {
    expect(muxTree(32, 4)).toEqual({ total: 11, partial: 1, levels: [8, 2, 1] })
    expect(muxTree(64, 4)).toEqual({ total: 21, partial: 0, levels: [16, 4, 1] })
    expect(muxTree(8, 4)).toEqual({ total: 3, partial: 1, levels: [2, 1] })
    expect(muxTree(16, 2).total).toBe(15)
    expect(muxTree(128, 4)).toEqual({ total: 43, partial: 1, levels: [32, 8, 2, 1] })
  })
  it('ROM bits', () => {
    expect(romBits(8, 2)).toBe(512)
    expect(romBits(6, 4)).toBe(256)
  })
})
