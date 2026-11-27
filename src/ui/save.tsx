import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LocalProgressStore, SAVE_KEY, applyUpdate, type ProgressStore, type SaveData } from '../game/progress'

type Update = (fn: (d: SaveData) => SaveData) => void
interface Ctx { save: SaveData; update: Update; store: ProgressStore; reload: () => void }
const SaveContext = createContext<Ctx | null>(null)

const defaultStore = new LocalProgressStore()

/**
 * Holds the save in React state. Every update re-reads the stored save first (load → fn → save), so a stale
 * tab can't erase another tab's progress, and a `storage` event from another tab reloads the save at once.
 */
export function SaveProvider({ store = defaultStore, children }: { store?: ProgressStore; children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => store.load())
  const ref = useRef(save)
  const update = useCallback<Update>(fn => {
    const next = applyUpdate(store, ref.current, fn)
    ref.current = next
    setSave(next)
  }, [store])
  const reload = useCallback(() => { const d = store.load(); ref.current = d; setSave(d) }, [store])
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === SAVE_KEY || e.key === null) reload() }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [reload])
  const value = useMemo(() => ({ save, update, store, reload }), [save, update, store, reload])
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>
}

function ctx(): Ctx {
  const c = useContext(SaveContext)
  if (!c) throw new Error('useSave must be used inside SaveProvider')
  return c
}

export function useSave(): [SaveData, Update] {
  const { save, update } = ctx()
  return [save, update]
}

export function useSaveStore(): { store: ProgressStore; reload: () => void } {
  const { store, reload } = ctx()
  return { store, reload }
}
