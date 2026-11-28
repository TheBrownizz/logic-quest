import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SyncEngine } from '../cloud/sync'
import { LocalProgressStore, SAVE_KEY, applyUpdate, type ProgressStore, type SaveData } from '../game/progress'

type Update = (fn: (d: SaveData) => SaveData) => SaveData
interface Internal {
  /** Applies a change that came from the sync engine: saved like any update, but never reported back to it. */
  applyRemote: (fn: (d: SaveData) => SaveData) => void
  /** Listens to changes the player made (not engine updates). */
  subscribe: (cb: (d: SaveData) => void) => () => void
  registerEngine: (e: SyncEngine | null) => void
}
interface Ctx { save: SaveData; update: Update; store: ProgressStore; reload: () => void; replace: (d: SaveData) => void; internal: Internal }
const SaveContext = createContext<Ctx | null>(null)

export const guestStore = new LocalProgressStore()

/**
 * Holds the save in React state. Every update re-reads the stored save first (load → fn → save), so a stale
 * tab can't erase another tab's progress, and a `storage` event from another tab reloads the save at once.
 * The provider is keyed by the save's owner (guest or user) by its parent, so each owner gets a fresh state.
 */
export function SaveProvider({ store = guestStore, children }: { store?: ProgressStore; children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => store.load())
  const ref = useRef(save)
  const listeners = useRef(new Set<(d: SaveData) => void>())
  const engine = useRef<SyncEngine | null>(null)
  const commit = useCallback((fn: (d: SaveData) => SaveData): SaveData => {
    const next = applyUpdate(store, ref.current, fn)
    ref.current = next
    setSave(next)
    return next
  }, [store])
  const update = useCallback<Update>(fn => {
    const next = commit(fn)
    listeners.current.forEach(cb => cb(next))
    return next
  }, [commit])
  const replace = useCallback((d: SaveData) => {
    const eng = engine.current
    if (!eng) { update(() => d); return }
    // Signed in: an explicit replace (reset, import) overrides the server too. A higher resetGen makes every
    // other device drop its older progress when it next syncs.
    const next = commit(() => ({ ...d, resetGen: (ref.current.resetGen ?? 0) + 1 }))
    eng.overwrite(next)
  }, [commit, update])
  const reload = useCallback(() => { const d = store.load(); ref.current = d; setSave(d) }, [store])
  useEffect(() => {
    const key = store.storageKey ?? SAVE_KEY
    const on = (e: StorageEvent) => { if (e.key === key || e.key === null) reload() }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [reload, store])
  const internal = useMemo<Internal>(() => ({
    applyRemote: fn => { commit(fn) },
    subscribe: cb => { listeners.current.add(cb); return () => { listeners.current.delete(cb) } },
    registerEngine: e => { engine.current = e },
  }), [commit])
  const value = useMemo(() => ({ save, update, store, reload, replace, internal }), [save, update, store, reload, replace, internal])
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

/** Replaces the whole save (reset, import). Signed in, it also overrides the server and every other device. */
export function useSaveReplace(): (d: SaveData) => void {
  return ctx().replace
}

export function useSaveInternal(): Internal & { store: ProgressStore } {
  const { internal, store } = ctx()
  return { ...internal, store }
}
