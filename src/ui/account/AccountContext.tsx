import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { consumePendingCode, deleteAccount as deleteAccountOnServer, exchangeCode, hasPendingCode, hasStoredSession, signInWithGoogle, userSaveKey } from '../../cloud/auth'
import { isCloudConfigured, loadSupabase } from '../../cloud/client'
import { SyncEngine, type SyncStatus } from '../../cloud/sync'
import type { SupabaseLike, SupabaseSession } from '../../cloud/types'
import { mergeSaves } from '../../game/merge'
import { LocalProgressStore, type ProgressStore, type SaveData } from '../../game/progress'
import { SaveProvider, guestStore, useSave, useSaveInternal } from '../save'
import { AttachGuestDialog } from './AttachGuestDialog'

export interface AccountUser { id: string; email: string; name: string; avatar?: string }
export type Busy = 'signin' | 'saving' | 'deleting' | null

export interface AccountApi {
  /** Accounts exist in this build (env vars or a test fake). When false, no account UI is shown. */
  supported: boolean
  user: AccountUser | null
  status: SyncStatus
  busy: Busy
  error: string | null
  signIn(): Promise<void>
  /** Writes pending changes (a reset included), then signs out. */
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
}

const none: AccountApi = {
  supported: false, user: null, status: 'synced', busy: null, error: null,
  signIn: async () => {}, signOut: async () => {}, deleteAccount: async () => {},
}
const AccountContext = createContext<AccountApi>(none)
export const useAccount = (): AccountApi => useContext(AccountContext)

const toUser = (s: SupabaseSession | null): AccountUser | null => {
  if (!s) return null
  const m = s.user.user_metadata ?? {}
  return { id: s.user.id, email: s.user.email ?? '', name: m.full_name ?? m.name ?? s.user.email ?? '', avatar: m.avatar_url ?? m.picture }
}

/** True when a save holds anything the player earned or made (so it is worth asking about). */
export function hasProgress(d: SaveData): boolean {
  return [d.rooms, d.chips, d.drafts, d.bestRun, d.helped, d.lessons].some(o => Object.keys(o).length > 0) ||
    [d.knowledge, d.flagged, d.openStages].some(a => a.length > 0)
}

const attachKey = (uid: string) => `lq-ui:attach:${uid}`
const ui = {
  get(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

let bootPromise: Promise<{ client: SupabaseLike; session: SupabaseSession | null; error: string | null } | null> | undefined
/** Once per page load: finishes an OAuth return and reads the stored session, loading the library only if needed. */
function boot() {
  bootPromise ??= (async () => {
    const code = consumePendingCode()
    if (!code && !hasStoredSession()) return null
    const client = await loadSupabase()
    if (!client) return null
    const error = code ? await exchangeCode(client, code) : null
    const { data } = await client.auth.getSession()
    return { client, session: data.session, error }
  })().catch(() => null)
  return bootPromise
}

/** Internal: lets the sync engine's owner (inside SaveProvider) report its engine and status upwards. */
function CloudSync({ client, user, onEngine, onStatus }: {
  client: SupabaseLike; user: AccountUser; onEngine: (e: SyncEngine | null) => void; onStatus: (s: SyncStatus) => void
}) {
  const { store, applyRemote, subscribe, registerEngine } = useSaveInternal()
  useEffect(() => {
    const engine = new SyncEngine(client, user.id, store, applyRemote)
    registerEngine(engine); onEngine(engine)
    // Only the player's own changes are reported to the engine, never updates it applied itself.
    const offChange = subscribe(d => engine.notifyChanged(d))
    const offStatus = engine.onStatus(onStatus)
    engine.start()
    return () => { offChange(); offStatus(); engine.stop(); registerEngine(null); onEngine(null) }
  }, [client, user.id, store, applyRemote, subscribe, registerEngine, onEngine, onStatus])
  return null
}

/** Offers (once per guest save) to bring the guest's progress into the account; never merges without an answer. */
function AttachGate({ user, guest }: { user: AccountUser; guest: ProgressStore }) {
  const [, update] = useSave()
  const [offer, setOffer] = useState<SaveData | null>(null)
  useEffect(() => {
    const g = guest.load()
    setOffer(hasProgress(g) && ui.get(attachKey(user.id)) !== String(g.savedAt ?? 0) ? g : null)
  }, [guest, user.id])
  if (!offer) return null
  const answer = (attach: boolean) => {
    ui.set(attachKey(user.id), String(offer.savedAt ?? 0))
    // The guest save has its own reset generation; join it to the account's so the merge is not a wholesale pick.
    if (attach) update(d => mergeSaves(d, { ...offer, resetGen: d.resetGen ?? 0 }))
    setOffer(null)
  }
  return <AttachGuestDialog email={user.email} onAttach={() => answer(true)} onKeep={() => answer(false)} />
}

export function AccountProvider({ store: guest = guestStore, children }: { store?: ProgressStore; children: ReactNode }) {
  const supported = isCloudConfigured()
  const [client, setClient] = useState<SupabaseLike | null>(null)
  const [user, setUser] = useState<AccountUser | null>(null)
  const [ready, setReady] = useState(() => !supported || !(hasPendingCode() || hasStoredSession()))
  const [status, setStatus] = useState<SyncStatus>('synced')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncRun, setSyncRun] = useState(0)
  const engine = useRef<SyncEngine | null>(null)
  const onEngine = useCallback((e: SyncEngine | null) => { engine.current = e }, [])

  useEffect(() => {
    if (!supported) return
    let off: (() => void) | undefined
    let live = true
    void boot().then(r => {
      if (!live) return
      if (r) {
        setClient(r.client)
        setUser(toUser(r.session))
        if (r.error) setError('ההתחברות נכשלה, אפשר לנסות שוב')
        const { data } = r.client.auth.onAuthStateChange((_e, s) => {
          const next = toUser(s)
          setUser(prev => (prev?.id === next?.id ? prev : next))
        })
        off = () => data.subscription.unsubscribe()
      }
      setReady(true)
    })
    return () => { live = false; off?.() }
  }, [supported])

  const signIn = useCallback(async () => {
    setError(null); setBusy('signin')
    try {
      const c = await loadSupabase()
      if (!c) throw new Error('not configured')
      setClient(c)
      const r = await signInWithGoogle(c)
      if (r.error) throw new Error(r.error)
    } catch {
      setError('ההתחברות נכשלה, אפשר לנסות שוב'); setBusy(null)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!client) return
    setError(null); setBusy('saving')
    try {
      await engine.current?.flush() // a pending reset or change is written before the account is left
      engine.current?.stop()
      await client.auth.signOut()
      setUser(null)
    } catch {
      setError('ההתנתקות נכשלה, אפשר לנסות שוב')
    } finally { setBusy(null) }
  }, [client])

  const deleteAccount = useCallback(async () => {
    if (!client || !user) return
    setError(null); setBusy('deleting')
    try {
      engine.current?.stop()
      await deleteAccountOnServer(client, user.id)
      setUser(null)
    } catch (e) {
      setError('מחיקת החשבון נכשלה, לא נמחק דבר')
      setSyncRun(n => n + 1) // restart the sync engine that was stopped
      throw e
    } finally { setBusy(null) }
  }, [client, user])

  const store = useMemo(() => (user ? new LocalProgressStore({ key: userSaveKey(user.id) }) : guest), [user, guest])
  const api = useMemo<AccountApi>(() => ({ supported, user, status, busy, error, signIn, signOut, deleteAccount }),
    [supported, user, status, busy, error, signIn, signOut, deleteAccount])

  if (!ready) return <p className="muted" role="status" style={{ textAlign: 'center', padding: '48px 16px' }}>טוען…</p>
  return (
    <AccountContext.Provider value={api}>
      <SaveProvider key={user?.id ?? 'guest'} store={store}>
        {user && client && <CloudSync key={syncRun} client={client} user={user} onEngine={onEngine} onStatus={setStatus} />}
        {user && <AttachGate user={user} guest={guest} />}
        {children}
      </SaveProvider>
    </AccountContext.Provider>
  )
}

