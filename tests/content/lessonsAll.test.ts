import { describe, it, expect } from 'vitest'
import { validateLessons } from '../../src/content/lessons/validate'
import { allLessons, figureDuplicates } from '../../src/content/lessons/catalog'
import { mergeFigures } from '../../src/content/lessons/figures'
import { widgetStep } from '../../src/content/lessons/widgetTypes'
import { switchingWorld } from '../../src/content/switching/world'
import { registry } from '../../src/ui/lessons/widgets/registry'
import { WIDGET_NAMES } from '../../src/content/lessons/types'

describe('all lessons together', () => {
  it('pass validateLessons as one set (ids unique across stages)', () => {
    const errs = validateLessons(switchingWorld, allLessons)
    expect(errs, errs.join('\n')).toEqual([])
  })
  it('no figure id is defined in two stage files', () => {
    expect(figureDuplicates).toEqual([])
  })
  it('mergeFigures reports a duplicate instead of overwriting it', () => {
    const r = mergeFigures([{ a: '<svg>1</svg>', b: '<svg/>' }, { a: '<svg>2</svg>' }, { a: '<svg>3</svg>' }])
    expect(r.duplicates).toEqual(['a'])
    expect(r.figures.a).toBe('<svg>1</svg>')
  })
})

describe('widget contract', () => {
  it('every widget is registered with a component and pure logic', () => {
    for (const name of WIDGET_NAMES) {
      expect(typeof registry[name].Component, name).toBe('function')
      expect(typeof registry[name].initial, name).toBe('function')
      expect(typeof registry[name].isGoalMet, name).toBe('function')
    }
  })
  it('widgetStep builds a widget step', () => {
    expect(widgetStep({ id: 'd', prompt: 'p', widget: 'BaseDial', config: { base: 2, width: 4 }, goal: { value: 5 }, example: { digits: [0, 1, 0, 1] } }))
      .toEqual({ id: 'd', kind: 'widget', prompt: 'p', widget: 'BaseDial', config: { base: 2, width: 4 }, goal: { value: 5 }, example: { digits: [0, 1, 0, 1] } })
  })
  it('widgetStep checks config, goal and example types at compile time (tsc runs over tests)', () => {
    // @ts-expect-error BaseDial has no `digitCount`; it is `width`
    widgetStep({ id: 'a', prompt: 'p', widget: 'BaseDial', config: { base: 2, digitCount: 4 } })
    // @ts-expect-error a BitField goal is { value: number }
    widgetStep({ id: 'b', prompt: 'p', widget: 'BitField', config: {}, goal: { bits: '0' } })
    // @ts-expect-error a MuxToy example state needs select and inputs
    widgetStep({ id: 'c', prompt: 'p', widget: 'MuxToy', config: { selectBits: 1, mode: 'route' }, goal: { kind: 'route', input: 1 }, example: { select: [1] } })
    // @ts-expect-error GateToy expressions are { fn, display }
    widgetStep({ id: 'd', prompt: 'p', widget: 'GateToy', config: { vars: ['A'], expr: 'A' } })
    expect(true).toBe(true)
  })
  it('stub initial states have the pinned shapes', () => {
    expect(registry.BaseDial.initial({ base: 2, width: 3 })).toEqual({ digits: [0, 0, 0] })
    expect(registry.BaseDial.initial({ base: 16, width: 2, digits: '1F' })).toEqual({ digits: [1, 15] })
    expect(registry.BitField.initial({}).bits).toHaveLength(32)
    expect(registry.MuxToy.initial({ selectBits: 2, mode: 'function' })).toEqual({ select: [0, 0], inputs: [0, 0, 0, 0] })
    expect(registry.GateToy.initial({ vars: ['A', 'B'], expr: { fn: () => 0, display: 'A·B' } })).toEqual({ inputs: { A: 0, B: 0 }, tried: [] })
  })
})
