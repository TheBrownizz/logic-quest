import type { SupabaseLike } from './types'

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

/** True when a Supabase session is stored in this browser (so loading the library is worth it). */
export function hasStoredSession(storage: { length: number; key(i: number): string | null } = localStorage): boolean {
  return tryDo(() => {
    for (let i = 0; i < storage.length; i++) if (/^sb-.+-auth-token$/.test(storage.key(i) ?? '')) return true
    return false
  }) ?? false
}

export async function exchangeCode(client: SupabaseLike, code: string): Promise<string | null> {
  const { error } = await client.auth.exchangeCodeForSession(code)
  return error?.message ?? null
}

export async function signOut(client: SupabaseLike): Promise<void> {
  await client.auth.signOut()
}

/**
 * Deletes the account through the edge function (which verifies the caller's JWT), then removes this user's
 * local save (the guest's save is untouched) and signs out. Throws if the server refused.
 */
export async function deleteAccount(client: SupabaseLike, uid: string, storage: StoreLike = localStorage): Promise<void> {
  const { error } = await client.functions.invoke('delete-account')
  if (error) throw new Error(error.message)
  tryDo(() => { storage.removeItem(userSaveKey(uid)); storage.removeItem(`${userSaveKey(uid)}-backup`) })
  await client.auth.signOut()
}
