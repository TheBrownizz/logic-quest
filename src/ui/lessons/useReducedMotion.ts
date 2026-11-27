import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
const query = () => (typeof matchMedia === 'function' ? matchMedia(QUERY) : null)

/** True while the user prefers reduced motion (follows changes to the setting). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => query()?.matches ?? false)
  useEffect(() => {
    const m = query()
    if (!m) return
    const on = () => setReduced(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return reduced
}
