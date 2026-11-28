/// <reference types="vite/client" />
import type { SupabaseLike } from './types'

declare const __E2E_FAKE__: boolean

let real: SupabaseLike | null | undefined
let loading: Promise<SupabaseLike | null> | undefined

const injectedFake = (): SupabaseLike | null => {
  const env = import.meta.env
  if (env.MODE !== 'test' && env.VITE_E2E_FAKE !== '1') return null
  return (globalThis as { __LQ_FAKE_SUPABASE__?: SupabaseLike }).__LQ_FAKE_SUPABASE__ ?? null
}

/**
 * Whether accounts are available at all: the build has the Supabase env vars, or a fake is injected
 * (test mode or VITE_E2E_FAKE=1 only). Synchronous and free: it never loads the Supabase library.
 */
export function isCloudConfigured(): boolean {
  const env = import.meta.env
  return __E2E_FAKE__ || injectedFake() !== null || !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}

/**
 * The client if it is already available (the injected fake, or the real client once `loadSupabase` has
 * resolved); otherwise null. Never starts a download.
 */
export function getSupabase(): SupabaseLike | null {
  return injectedFake() ?? real ?? null
}

/**
 * The Supabase client, or null when the app isn't configured (the game is then guest-only). The library is
 * imported dynamically, only here and only when configured, so guests never download it. The URL and anon
 * key come only from the build environment; no service key is ever used.
 */
export function loadSupabase(): Promise<SupabaseLike | null> {
  const fake = injectedFake()
  if (fake) return Promise.resolve(fake)
  const env = import.meta.env
  // Build-time flag: in a normal build this condition is a constant false and the fake is not in the bundle.
  if (__E2E_FAKE__) {
    loading ??= import('./e2eFake').then(m => { real = m.createE2eFake(); return real })
    return loading
  }
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return Promise.resolve(null)
  if (real) return Promise.resolve(real)
  loading ??= import('@supabase/supabase-js')
    .then(m => { real = m.createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } }); return real })
    .catch(() => { loading = undefined; return null })
  return loading
}
