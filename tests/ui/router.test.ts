import { describe, it, expect } from 'vitest'
import { hrefs, parseHash } from '../../src/ui/router'

describe('hrefs.lesson', () => {
  it('round-trips through parseHash', () => {
    expect(parseHash(hrefs.lesson('a b'))).toEqual({ name: 'lesson', lessonId: 'a b' })
    expect(parseHash(hrefs.lesson('a', 'x/y'))).toEqual({ name: 'lesson', lessonId: 'a', stepId: 'x/y' })
  })
})

describe('parseHash', () => {
  it('parses good routes', () => {
    expect(parseHash('')).toEqual({ name: 'map' })
    expect(parseHash('#/')).toEqual({ name: 'map' })
    expect(parseHash('#/world/switching')).toEqual({ name: 'world', worldId: 'switching' })
    expect(parseHash('#/world/switching/stage/sw-1')).toEqual({ name: 'stage', worldId: 'switching', stageId: 'sw-1' })
    expect(parseHash('#/room/r%201')).toEqual({ name: 'room', roomId: 'r 1' })
    expect(parseHash('#/run/s')).toEqual({ name: 'run', stageId: 's' })
    expect(parseHash('#/collection')).toEqual({ name: 'collection' })
    expect(parseHash('#/lesson/sw-1-l1')).toEqual({ name: 'lesson', lessonId: 'sw-1-l1' })
    expect(parseHash('#/lesson/sw-1-l1/s%203')).toEqual({ name: 'lesson', lessonId: 'sw-1-l1', stepId: 's 3' })
    expect(parseHash('#/lesson/sw-1-l1?quiz=1')).toEqual({ name: 'lesson', lessonId: 'sw-1-l1' })
  })
  it('unknown routes -> notfound', () => {
    for (const h of ['#/nope', '#/world', '#/world/a/stage', '#/room/a/b', '#/collection/x', '#/lesson', '#/lesson/a/b/c'])
      expect(parseHash(h)).toEqual({ name: 'notfound' })
  })
  it('malformed escapes -> notfound, no throw', () => {
    for (const h of ['#/world/%E0%A4%A', '#/%', '#/room/%'])
      expect(parseHash(h)).toEqual({ name: 'notfound' })
  })
})
