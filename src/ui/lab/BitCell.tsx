import type { KeyboardEvent } from 'react'
import type { Bit } from '../../logic/boolean'

/** Moves focus to the next (or previous) bit cell in the same group. */
function focusSibling(el: HTMLElement, step: 1 | -1) {
  const group = el.closest('[data-bitgroup]')
  if (!group) return
  const cells = [...group.querySelectorAll<HTMLButtonElement>('button[data-bitcell]:not(:disabled)')]
  cells[cells.indexOf(el as HTMLButtonElement) + step]?.focus()
}

/**
 * One 0/1 cell the player fills: a click cycles · → 0 → 1 → 0; on the keyboard 0 or 1 sets it and moves on,
 * Backspace clears it, arrows move between cells. Put the cells inside an element with `data-bitgroup`.
 */
export function BitCell({ value, onChange, label, state, disabled, testId }: {
  value: Bit | null
  onChange: (v: Bit | null) => void
  label: string
  state?: 'ok' | 'err' | 'miss'
  disabled?: boolean
  testId?: string
}) {
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    if (e.key === '0' || e.key === '1') { e.preventDefault(); onChange(e.key === '1' ? 1 : 0); focusSibling(el, 1) }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onChange(null) }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusSibling(el, 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusSibling(el, -1) }
  }
  return (
    <button type="button" data-bitcell className={`bitcell mono${value === null ? ' empty' : ` v${value}`}${state ? ` ${state}` : ''}`}
      data-testid={testId} aria-label={`${label}: ${value ?? 'ריק'}`} disabled={disabled}
      onClick={() => onChange(value === 1 ? 0 : value === 0 ? 1 : 0)} onKeyDown={key}>
      {value ?? '·'}
    </button>
  )
}
