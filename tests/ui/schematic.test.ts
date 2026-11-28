import { describe, it, expect } from 'vitest'
import { HOP, layoutSchematic, pathPoints, wirePath, type Prim, type Pt } from '../../src/ui/schematic/geometry'
import type { Netlist } from '../../src/ui/schematic/netlist'

const wires = (l: ReturnType<typeof layoutSchematic>) => l.prims.filter((p): p is Extract<Prim, { t: 'wire' }> => p.t === 'wire')
const circles = (l: ReturnType<typeof layoutSchematic>, cls: string) => l.prims.filter((p): p is Extract<Prim, { t: 'circle' }> => p.t === 'circle' && p.cls === cls)
const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
const orthogonal = (pts: Pt[]) => pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y)
const allPoints = (l: ReturnType<typeof layoutSchematic>): Pt[] => l.prims.flatMap(p =>
  p.t === 'wire' ? p.points : p.t === 'circle' ? [{ x: p.cx - p.r, y: p.cy - p.r }, { x: p.cx + p.r, y: p.cy + p.r }]
    : p.t === 'text' ? [{ x: p.x, y: p.y }] : pathPoints(p.d))

/** The moed-B style gated D latch: A (data), B (enable), NOT, two NANDs into a NAND latch. */
const dLatch: Netlist = {
  parts: [
    { id: 'A', kind: 'in', label: 'A', at: [0, 0] },
    { id: 'B', kind: 'in', label: 'B', at: [0, 1] },
    { id: 'inv', kind: 'NOT', at: [1, 2.4] },
    { id: 'g1', kind: 'NAND', at: [2, 0.2] },
    { id: 'g2', kind: 'NAND', at: [2, 1.8] },
    { id: 'L', kind: 'latch', gate: 'NAND', at: [3.3, 1] },
    { id: 'Q', kind: 'out', label: 'Q', at: [4.4, 1 - 40 / 60] },
    { id: 'Qn', kind: 'out', label: "Q'", at: [4.4, 1 + 40 / 60] },
  ],
  wires: [
    { from: 'A', to: 'g1.0' }, { from: 'A', to: 'inv' }, { from: 'B', to: 'g1.1' }, { from: 'B', to: 'g2.0' },
    { from: 'inv', to: 'g2.1' }, { from: 'g1', to: 'L.a' }, { from: 'g2', to: 'L.b' }, { from: 'L.Q', to: 'Q' }, { from: 'L.Qn', to: 'Qn' },
  ],
  frame: { from: [1, 0], to: [3.6, 2.4] },
}

describe('layoutSchematic', () => {
  it('a single NOT: the wire runs from the input terminal pin to the gate input pin, then to the output', () => {
    const l = layoutSchematic({ parts: [{ id: 'X', kind: 'in', label: 'X', at: [0, 0] }, { id: 'n', kind: 'NOT', at: [1, 0] }, { id: 'Y', kind: 'out', label: 'Y', at: [2, 0] }], wires: [{ from: 'X', to: 'n' }, { from: 'n', to: 'Y' }] })
    const [w1, w2] = wires(l)
    expect(same(w1.points[0], l.pins['X.out'])).toBe(true)
    expect(same(w1.points[w1.points.length - 1], l.pins['n.0'])).toBe(true)
    expect(same(w2.points[0], l.pins['n.out'])).toBe(true)
    expect(same(w2.points[w2.points.length - 1], l.pins['Y.in'])).toBe(true)
    expect(circles(l, 'bubble')).toHaveLength(1)
  })

  it('every wire is orthogonal and ends on its pins; a fan-out gets one junction dot per branch point', () => {
    const l = layoutSchematic(dLatch)
    for (const w of wires(l)) expect(orthogonal(w.points), w.net).toBe(true)
    expect(wires(l)).toHaveLength(dLatch.wires.length)
    // A and B each fan out to two gates: one dot each (plus the latch's two feedback dots)
    const dots = circles(l, 'dot')
    expect(dots.length).toBe(4)
  })

  it('M4: where two nets cross, the horizontal run hops over the vertical one (no dot)', () => {
    const l = layoutSchematic(dLatch)
    const hops = wires(l).flatMap(w => w.hops.map(h => ({ w, h })))
    expect(hops.length).toBeGreaterThan(0)
    for (const { w, h } of hops) {
      expect(w.points.some((p, i) => i > 0 && p.y === h.y && w.points[i - 1].y === h.y)).toBe(true)
      expect(circles(l, 'dot').some(d => d.cx === h.x && d.cy === h.y)).toBe(false)
    }
    expect(wirePath([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }], [{ x: 20, y: 0 }])).toBe(`M0,0 H${20 - HOP} A${HOP} ${HOP} 0 0 1 ${20 + HOP},0 H40 V20`)
  })

  it('the cross-coupled latch draws two gates, the X and outputs Q above Qn', () => {
    const l = layoutSchematic({ parts: [{ id: 'L', kind: 'latch', gate: 'NOR', at: [0, 0] }], wires: [] })
    expect(l.pins['L.Q'].y).toBeLessThan(l.pins['L.Qn'].y)
    expect(l.pins['L.a'].y).toBeLessThan(l.pins['L.b'].y)
    expect(circles(l, 'bubble')).toHaveLength(2) // two NOR bubbles
    const cross = l.prims.filter(p => p.t === 'path' && p.cls === 'line')
    expect(cross).toHaveLength(2)
  })

  it('a rising-edge flip-flop has a clock triangle at C and no bubble; falling adds a bubble; level has neither triangle', () => {
    const ff = (clock: 'rise' | 'fall' | 'high' | 'low') =>
      layoutSchematic({ parts: [{ id: 'F', kind: 'ff', ff: 'JK', clock, at: [0, 0] }], wires: [] })
    const rise = ff('rise')
    const tri = rise.prims.filter(p => p.t === 'path' && p.cls === 'clock')
    expect(tri).toHaveLength(1)
    const c = rise.pins['F.C']
    expect((tri[0] as { d: string }).d).toContain(`,${c.y}`)
    expect(circles(rise, 'bubble')).toHaveLength(0)
    expect(circles(ff('fall'), 'bubble')).toHaveLength(1)
    expect(ff('high').prims.filter(p => p.t === 'path' && p.cls === 'clock')).toHaveLength(0)
    expect(circles(ff('low'), 'bubble')).toHaveLength(1)
    for (const pin of ['J', 'K', 'C', 'Q', 'Qn']) expect(rise.pins[`F.${pin}`], pin).toBeDefined()
    expect(rise.pins['F.J'].y).toBeLessThan(rise.pins['F.C'].y)
    expect(rise.pins['F.C'].y).toBeLessThan(rise.pins['F.K'].y)
  })

  it('a feedback wire goes around the parts (right, then up or down, back left)', () => {
    const l = layoutSchematic({
      parts: [{ id: 'J', kind: 'in', label: 'J', at: [0, 0] }, { id: 'g', kind: 'AND', at: [1, 0] }, { id: 'h', kind: 'NOR', at: [2, 0] }],
      wires: [{ from: 'J', to: 'g.1' }, { from: 'g', to: 'h.0' }, { from: 'h', to: 'g.0' }],
    })
    const fb = wires(l).find(w => w.net === 'h.out')!
    expect(orthogonal(fb.points)).toBe(true)
    expect(fb.points.length).toBe(6)
    const top = Math.min(...fb.points.map(p => p.y))
    expect(top).toBeLessThan(l.pins['g.0'].y - 20)
    expect(fb.points[2].x).toBeGreaterThan(l.pins['h.out'].x)
    expect(fb.points[3].x).toBeLessThan(l.pins['g.0'].x)
  })

  it('the box contains every drawn point', () => {
    const l = layoutSchematic(dLatch)
    const { x, y, w, h } = l.box
    for (const p of allPoints(l)) {
      expect(p.x).toBeGreaterThanOrEqual(x)
      expect(p.x).toBeLessThanOrEqual(x + w)
      expect(p.y).toBeGreaterThanOrEqual(y)
      expect(p.y).toBeLessThanOrEqual(y + h)
    }
    expect(l.prims.some(p => p.t === 'path' && p.cls === 'frame')).toBe(true)
  })

  it('pathPoints follows H and V runs (a frame\'s corners are in the box)', () => {
    expect(pathPoints('M0,0 H10 V5 H0 Z')).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }])
    expect(pathPoints('M4,-22 A22 22 0 0 1 4,22')).toEqual([{ x: 4, y: -22 }, { x: 4, y: 22 }])
  })

  it('unknown parts and pins throw a readable error', () => {
    expect(() => layoutSchematic({ parts: [], wires: [{ from: 'a', to: 'b' }] })).toThrow(/unknown part "a"/)
    expect(() => layoutSchematic({ parts: [{ id: 'n', kind: 'NOT', at: [0, 0] }, { id: 'm', kind: 'NOT', at: [1, 0] }], wires: [{ from: 'n', to: 'm.3' }] })).toThrow(/pin "m.3"/)
    expect(() => layoutSchematic({ parts: [{ id: 'n', kind: 'NOT', at: [0, 0] }, { id: 'n', kind: 'NOT', at: [1, 0] }], wires: [] })).toThrow(/duplicate/)
  })
})
