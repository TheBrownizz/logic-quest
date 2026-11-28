import { useEffect, useRef } from 'react'

/** Focuses the dialog panel when it opens, closes on Escape, and returns focus to what had it before. */
export function useDialog(onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => { window.removeEventListener('keydown', on); before?.focus?.() }
  }, [onClose])
  return panel
}
