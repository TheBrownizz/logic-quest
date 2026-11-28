import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focuses the dialog panel when it opens, closes on Escape, keeps Tab inside the panel, and returns focus to
 * what had it before. `onClose` may change on every render without moving focus.
 */
export function useDialog(onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) { e.preventDefault(); panel.current.focus(); return }
      const first = items[0], last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.current.contains(active) || active === panel.current) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', on)
    return () => { window.removeEventListener('keydown', on); before?.focus?.() }
  }, [])
  return panel
}
