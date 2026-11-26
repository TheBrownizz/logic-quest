import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { LocalProgressStore, type ProgressStore, type SaveData } from '../game/progress'

type Update = (fn: (d: SaveData) => SaveData) => void
interface Ctx { save: SaveData; update: Update; store: ProgressStore; reload: () => void }
const SaveContext = createContext<Ctx | null>(null)

const defaultStore = new LocalProgressStore()

/** Holds the save in React state and persists through the store on every update. */
export function SaveProvider({ store = defaultStore, children }: { store?: ProgressStore; children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => store.load())
  const ref = useRef(save)
  ref.current = save
  const update = useCallback<Update>(fn => {
    const next = fn(ref.current)
    ref.current = next
    store.save(next)
    setSave(next)
  }, [store])
  const reload = useCallback(() => { const d = store.load(); ref.current = d; setSave(d) }, [store])
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
