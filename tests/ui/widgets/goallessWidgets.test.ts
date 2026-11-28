import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ComplementLab } from '../../../src/ui/lessons/widgets/ComplementLab'
import { BaseConvert } from '../../../src/ui/lessons/widgets/BaseConvert'

const noop = () => {}
const html = (el: ReturnType<typeof createElement>) => renderToString(el)

describe('a widget step with no goal opens at its starting state, even when the player marks it complete', () => {
  it('ComplementLab', () => {
    const config = { base: 2, digits: 4, value: '0110', mode: 'complement' as const }
    const open = html(createElement(ComplementLab, { config, onState: noop, completed: true, reducedMotion: false }))
    expect(open).toContain('data-phase="value"')
    expect(open).not.toContain('data-testid="cl-done"')
    const final = html(createElement(ComplementLab, { config, goal: { phase: 'r' }, onState: noop, completed: true, reducedMotion: false }))
    expect(final).toContain('data-phase="r"')
    expect(final).toContain('data-testid="cl-done"')
  })
  it('BaseConvert', () => {
    const config = { from: 10, to: 2, value: '59', mode: 'divide' as const }
    const open = html(createElement(BaseConvert, { config, onState: noop, completed: true, reducedMotion: false }))
    expect(open).not.toContain('class="bc-row mono shown')
    const final = html(createElement(BaseConvert, { config, goal: { finished: true }, onState: noop, completed: true, reducedMotion: false }))
    expect(final).toContain('class="bc-row mono shown')
  })
})
