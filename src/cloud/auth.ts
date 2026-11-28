/// <reference types="vite/client" />
import type { SupabaseLike } from './types'

declare const __E2E_FAKE__: boolean

/** sessionStorage key holding the hash (the screen the player was on) across the round trip to Google. */
export const RETURN_HASH_KEY = 'lq-ui:return-hash'
export const userSaveKey = (uid: string): string => `logic-quest-save:${uid}`

interface LocLike { origin: string; pathname: string; search: string; hash: string }
interface HistLike { replaceState(data: unknown, unused: string, url?: string | null): void }
interface StoreLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const tryDo = <T,>(f: () => T): T | undefined => { try { return f() } catch { return undefined } }

/** Starts the Google sign-in: remembers the current hash, then leaves for Google (PKCE; the client is built with it). */
export async function signInWithGoogle(
  client: SupabaseLike, loc: LocLike = window.location, storage: StoreLike = sessionStorage,
): Promise<{ error: string | null }> {
  tryDo(() => storage.setItem(RETURN_HASH_KEY, loc.hash))
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: loc.origin + loc.pathname } })
  return { error: error?.message ?? null }
}

const OAUTH_PARAMS = ['code', 'error', 'error_code', 'error_description']

/**
 * On the return from Google (`?code=...`): removes the OAuth query from the address, restores the hash the
 * player had before leaving, and returns the code (null when the page isn't an OAuth return, and then
 * nothing is touched). Synchronous, so it can run before the router reads the hash.
 */
export function takeRedirectCode(
  loc: LocLike = window.location, history: HistLike = window.history, storage: StoreLike = sessionStorage,
): string | null {
  const params = new URLSearchParams(loc.search)
  if (!OAUTH_PARAMS.some(k => params.has(k))) return null
  const code = params.get('code')
  for (const k of OAUTH_PARAMS) params.delete(k)
  const query = params.toString()
  const saved = tryDo(() => storage.getItem(RETURN_HASH_KEY))
  tryDo(() => storage.removeItem(RETURN_HASH_KEY))
  const hash = saved ?? loc.hash
  history.replaceState(null, '', loc.pathname + (query ? `?${query}` : '') + hash)
  return code
}

let pendingCode: string | null = null
/** Call once, before the first render. */
export function captureRedirect(): void { pendingCode = takeRedirectCode() }
export function consumePendingCode(): string | null { const c = pendingCode; pendingCode = null; return c }
export const hasPendingCode = (): boolean => pendingCode !== null

/**
 * The exact localStorage keys supabase-js uses for this project (`sb-<ref>-auth-token` and its PKCE verifier),
 * derived from the project URL the same way the library does: the first label of the host name. Exact keys,
 * not a pattern: GitHub Pages project sites share one origin, so another app's `sb-*` keys must stay untouched.
 */
export function sessionKeys(
  url: string | undefined = import.meta.env.VITE_SUPABASE_URL,
  extra: string[] = __E2E_FAKE__ ? ['sb-fake-auth-token'] : [],
): string[] {
  let ref: string | undefined
  try { ref = url ? new URL(url).hostname.split('.')[0] : undefined } catch { ref = undefined }
  const base = ref ? [`sb-${ref}-auth-token`, `sb-${ref}-auth-token-code-verifier`] : []
  return [...base, ...extra]
}

/** True when this project's Supabase session is stored in this browser (so loading the library is worth it). */
export function hasStoredSession(storage: { getItem(k: string): string | null } = localStorage, keys: string[] = sessionKeys()): boolean {
  return tryDo(() => keys.some(k => storage.getItem(k) !== null)) ?? false
}

export async function exchangeCode(client: SupabaseLike, code: string): Promise<string | null> {
  const { error } = await client.auth.exchangeCodeForSession(code)
  return error?.message ?? null
}

/** Written on every sign-out; other open tabs see the change (a `storage` event) and drop back to guest mode. */
export const SIGNED_OUT_KEY = 'lq-ui:signed-out'

/**
 * Ends this browser's session, even when offline: asks for a local-scope sign-out (no network needed) and, if
 * the library still reports an error, removes this project's stored session keys itself. Then pings the other
 * tabs. Never throws; after it, a reload cannot bring the account back.
 */
export async function signOut(client: SupabaseLike, storage: StoreLike = localStorage, keys: string[] = sessionKeys()): Promise<void> {
  try { await client.auth.signOut({ scope: 'local' }) } catch { /* fall through to the hard removal */ }
  tryDo(() => keys.forEach(k => storage.removeItem(k)))
  tryDo(() => storage.setItem(SIGNED_OUT_KEY, String(Date.now())))
}

/** Rejects if `p` takes longer than `ms` (so a hung network can't keep the game on a loading screen). */
export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/**
 * Deletes the account through the edge function (which verifies the caller's JWT), then removes this user's
 * local save (the guest's save is untouched) and ends the session. Throws only if the server refused; once the
 * server has deleted the account, a sign-out problem is not an error.
 */
export async function deleteAccount(client: SupabaseLike, uid: string, storage: StoreLike = localStorage, keys: string[] = sessionKeys()): Promise<void> {
  const { error } = await client.functions.invoke('delete-account')
  if (error) throw new Error(error.message)
  tryDo(() => { storage.removeItem(userSaveKey(uid)); storage.removeItem(`${userSaveKey(uid)}-backup`) })
  await signOut(client, storage, keys)
}
