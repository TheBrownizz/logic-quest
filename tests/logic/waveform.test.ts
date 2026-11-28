import { describe, it, expect } from 'vitest'
import { simulateWave, validateWaveConfig } from '../../src/logic/waveform'
import type { Bit } from '../../src/logic/boolean'

const b = (s: string) => [...s].map(c => Number(c) as Bit)

describe('simulateWave: latch-D (transparent while clk=1)', () => {
  it('follows D while clk=1, holds while clk=0', () => {
    //            clk  0 1 1 0 0 1 1 0
    //            D    1 1 0 0 1 1 0 0   (D constant across each closing boundary)
    expect(simulateWave('latch-D', b('01100110'), { D: b('11001100') }, 0)).toEqual([0, 1, 0, 0, 0, 1, 0, 0] as Bit[])
  })
  it('holds q0 through an initially-closed latch', () => {
    expect(simulateWave('latch-D', b('0000'), { D: b('1111') }, 1)).toEqual(b('1111'))
  })
  it('D change at the closing boundary is a race', () => {
    expect(() => simulateWave('latch-D', b('110'), { D: b('101') }, 0)).toThrow(/race/i)
  })
})

describe('simulateWave: latch-SR (gated by clk)', () => {
  it('sets, resets and holds while enabled; ignores inputs while clk=0', () => {
    // clk 11100111 ; S 01001100 ; R 00110001 (S=1 at col 4 is ignored: clk=0)
    expect(simulateWave('latch-SR', b('11100111'), { S: b('01001100'), R: b('00110001') }, 0)).toEqual(
      [0, 1, 0, 0, 0, 1, 1, 0] as Bit[],
    )
  })
  it('throws on S=R=1 while enabled', () => {
    expect(() => simulateWave('latch-SR', b('111'), { S: b('010'), R: b('011') }, 0)).toThrow(/forbidden/i)
  })
})

describe('simulateWave: ff-D (rising edge)', () => {
  it('samples D just before each rising edge', () => {
    // clk  0 1 0 1 0 1 0 1
    // D    1 1 0 0 1 1 0 0   edges at cols 1,3,5,7 sample cols 0,2,4,6 = 1,0,1,0 ; D changes at the falling boundaries only
    expect(simulateWave('ff-D', b('01010101'), { D: b('11001100') }, 0)).toEqual([0, 1, 1, 0, 0, 1, 1, 0] as Bit[])
  })
  it('does not respond to the falling edge or to D while clk is high', () => {
    expect(simulateWave('ff-D', b('0111000'), { D: b('1100011') }, 0)).toEqual([0, 1, 1, 1, 1, 1, 1] as Bit[])
  })
  it('D changing exactly at the rising edge is a race', () => {
    expect(() => simulateWave('ff-D', b('01'), { D: b('01') }, 0)).toThrow(/race/i)
  })
  it('a rising edge needs a previous column (column 0 is never an edge)', () => {
    expect(simulateWave('ff-D', b('1100'), { D: b('1100') }, 0)).toEqual(b('0000'))
  })
})

describe('simulateWave: ff-T', () => {
  it('toggles on every rising edge with T=1, holds with T=0', () => {
    // clk 0 1 0 1 0 1 0 1 ; T 1 1 0 0 1 1 1 1 -> sample before edges: cols 0,2,4,6 = 1,0,1,1
    expect(simulateWave('ff-T', b('01010101'), { T: b('11001111') }, 0)).toEqual(
      [0, 1, 1, 1, 1, 0, 0, 1] as Bit[],
    )
  })
})

describe('simulateWave: ff-JK', () => {
  it('J=K=1 toggles at the edge', () => {
    // clk 0101010101 ; J=K=1 constant -> toggles each edge
    const out = simulateWave('ff-JK', b('0101010101'), { J: b('1111111111'), K: b('1111111111') }, 0)
    expect(out).toEqual([0, 1, 1, 0, 0, 1, 1, 0, 0, 1] as Bit[])
  })
  it('set / reset / hold', () => {
    // edges at cols 1,3,5,7 sample cols 0,2,4,6: (J,K) = 10, 00, 01, 00
    const J = b('11000000')
    const K = b('00001100')
    expect(simulateWave('ff-JK', b('01010101'), { J, K }, 0)).toEqual([0, 1, 1, 1, 1, 0, 0, 0] as Bit[])
  })
})

describe('simulateWave: input validation', () => {
  it('throws on missing or wrong-length inputs', () => {
    expect(() => simulateWave('ff-D', b('0101'), {}, 0)).toThrow()
    expect(() => simulateWave('ff-D', b('0101'), { D: b('01') }, 0)).toThrow()
    expect(() => simulateWave('ff-JK', b('0101'), { J: b('0000') }, 0)).toThrow()
  })
})

describe('level vs edge (phases spanning several columns)', () => {
  it('latch-D and ff-D differ on the same inputs', () => {
    const clk = b('01110')
    const D = b('00111')
    expect(simulateWave('latch-D', clk, { D }, 0)).toEqual([0, 0, 1, 1, 1])
    expect(simulateWave('ff-D', clk, { D }, 0)).toEqual([0, 0, 0, 0, 0])
  })
  it('a glitch while clk is high passes through a latch but not a flip-flop', () => {
    const clk = b('0111110')
    const D = b('0010000')
    expect(simulateWave('latch-D', clk, { D }, 0)).toEqual([0, 0, 1, 0, 0, 0, 0])
    expect(simulateWave('ff-D', clk, { D }, 0)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('latch-SR closing race relaxation', () => {
  it('a lone S 1->0 with R=0 at closing is harmless', () => {
    expect(simulateWave('latch-SR', b('110'), { S: b('110'), R: b('000') }, 0)).toEqual([1, 1, 1])
  })
  it('a lone R 1->0 with S=0 at closing is harmless', () => {
    expect(simulateWave('latch-SR', b('110'), { S: b('000'), R: b('110') }, 1)).toEqual([0, 0, 0])
  })
  it('other changes at closing still race', () => {
    expect(() => simulateWave('latch-SR', b('110'), { S: b('100'), R: b('001') }, 0)).toThrow(/race/i)
    expect(() => simulateWave('latch-SR', b('110'), { S: b('000'), R: b('001') }, 0)).toThrow(/race/i)
  })
})

describe('q0 and bit validation', () => {
  it('q0 is the state before column 0', () => {
    expect(simulateWave('ff-T', b('000'), { T: b('111') }, 1)).toEqual([1, 1, 1])
  })
  it('rejects non-bit values', () => {
    expect(() => simulateWave('ff-D', [0, 2 as never], { D: b('00') }, 0)).toThrow()
    expect(() => simulateWave('ff-D', b('01'), { D: [0, 2 as never] }, 0)).toThrow()
    expect(() => simulateWave('ff-D', b('01'), { D: b('00') }, 2 as never)).toThrow()
  })
})

describe('validateWaveConfig', () => {
  const v = (clk: string, D: string) => validateWaveConfig('ff-D', b(clk), { D: b(D) }, 0)
  it('accepts multi-column phases with stable boundaries', () => {
    expect(v('0011110', '0001100')).toEqual([])
  })
  it('flags input changes at any clk transition', () => {
    expect(v('0011', '0001')).toEqual([])
    expect(v('0011', '0010')).toHaveLength(1)
    expect(v('01110', '00111')).toEqual([])
  })
  it('reports problems', () => {
    expect(v('0101', '0011').length).toBeGreaterThan(0)
    expect(v('0000', '0000')).toContain('clk has no rising edge')
    expect(v('01', '0').length).toBeGreaterThan(0)
    expect(validateWaveConfig('ff-D', [0, 3 as never], {}, 0).length).toBeGreaterThan(0)
    expect(validateWaveConfig('ff-JK', b('01'), { J: b('00') }, 0).length).toBeGreaterThan(0)
  })
  it('rejects SR latch S=R=1 in any column, as the simulator does', () => {
    const clk = b('1110011')
    const inputs = { S: b('0000110'), R: b('0100110') } // S=R=1 at cols 5,6
    expect(validateWaveConfig('latch-SR', clk, inputs, 0).some(e => /forbidden/.test(e))).toBe(true)
    // also while disabled (clk=0)
    const disabled = { S: b('0001100'), R: b('0001100') }
    expect(validateWaveConfig('latch-SR', b('1110011'), disabled, 0).length).toBeGreaterThan(0)
    // simulator throws on the enabled case
    expect(() => simulateWave('latch-SR', clk, inputs, 0)).toThrow(/forbidden/)
  })
  it('property: validator accepts => simulateWave does not throw (seeded random)', () => {
    let seed = 12345
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    const kinds = ['latch-D', 'latch-SR', 'ff-D', 'ff-T', 'ff-JK'] as const
    const names = { 'latch-D': ['D'], 'latch-SR': ['S', 'R'], 'ff-D': ['D'], 'ff-T': ['T'], 'ff-JK': ['J', 'K'] }
    let accepted = 0
    for (let n = 0; n < 4000; n++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)]
      const len = 3 + Math.floor(rnd() * 10)
      const bit = (p: number) => (rnd() < p ? 1 : 0) as Bit
      // clk in runs of 1-3 columns
      const clk: Bit[] = []
      let c = bit(0.5)
      while (clk.length < len) {
        for (let k = 1 + Math.floor(rnd() * 3); k > 0 && clk.length < len; k--) clk.push(c)
        c = (1 - c) as Bit
      }
      const inputs: Record<string, Bit[]> = {}
      for (const nm of names[kind]) inputs[nm] = Array.from({ length: len }, () => bit(0.4))
      const q0 = bit(0.5)
      if (validateWaveConfig(kind, clk, inputs, q0).length === 0) {
        accepted++
        expect(() => simulateWave(kind, clk, inputs, q0)).not.toThrow()
      }
    }
    expect(accepted).toBeGreaterThan(50)
  })
})
