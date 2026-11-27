import { describe, it, expect } from 'vitest'
import { parseHash } from '../../src/ui/router'

describe('parseHash', () => {
  it('parses good routes', () => {
    expect(parseHash('')).toEqual({ name: 'map' })
    expect(parseHash('#/')).toEqual({ name: 'map' })
    expect(parseHash('#/world/switching')).toEqual({ name: 'world', worldId: 'switching' })
    expect(parseHash('#/world/switching/stage/sw-1')).toEqual({ name: 'stage', worldId: 'switching', stageId: 'sw-1' })
    expect(parseHash('#/room/r%201')).toEqual({ name: 'room', roomId: 'r 1' })
    expect(parseHash('#/run/s')).toEqual({ name: 'run', stageId: 's' })
    expect(parseHash('#/collection')).toEqual({ name: 'collection' })
  })
  it('unknown routes -> notfound', () => {
    for (const h of ['#/nope', '#/world', '#/world/a/stage', '#/room/a/b', '#/collection/x'])
      expect(parseHash(h)).toEqual({ name: 'notfound' })
  })
  it('malformed escapes -> notfound, no throw', () => {
    for (const h of ['#/world/%E0%A4%A', '#/%', '#/room/%'])
      expect(parseHash(h)).toEqual({ name: 'notfound' })
  })
})
