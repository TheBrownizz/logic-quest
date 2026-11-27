import { describe, it, expect } from 'vitest'
import { expectLessonsValid, stepCounts } from './lessonTestUtils'

// Task 1 ships one sample lesson; Task 2 replaces it with the real three (and asserts expectFullLesson).
describe('stage 1 lessons', () => {
  it('pass validateLessons', () => {
    expect(expectLessonsValid('sw-1-numbers').length).toBeGreaterThanOrEqual(1)
  })
  it('the sample lesson uses every engine step kind the stubs can run', () => {
    const [l] = expectLessonsValid('sw-1-numbers')
    const c = stepCounts(l)
    for (const k of ['explain', 'check', 'check-number', 'try', 'recap', 'widget'] as const) expect(c[k], k).toBeGreaterThanOrEqual(1)
    expect(l.steps.some(s => s.kind === 'try' && s.puzzle.type === 'number')).toBe(true)
    expect(l.steps.some(s => s.kind === 'widget' && s.goal === undefined)).toBe(true)
  })
})
