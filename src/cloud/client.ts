/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'
import type { SupabaseLike } from './types'

let real: SupabaseLike | null | undefined

/**
 * The Supabase client, or null when the app isn't configured (no env vars): the game then runs as a guest only.
 * A fake client may be injected on `window.__LQ_FAKE_SUPABASE__`, only in test mode or with VITE_E2E_FAKE=1.
 * The URL and anon key come only from the build environment; no service key is ever used here.
 */
export function getSupabase(): SupabaseLike | null {
  const env = import.meta.env
  if (env.MODE === 'test' || env.VITE_E2E_FAKE === '1') {
    const fake = (globalThis as { __LQ_FAKE_SUPABASE__?: SupabaseLike }).__LQ_FAKE_SUPABASE__
    if (fake) return fake
  }
  if (real !== undefined) return real
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY
  real = url && key ? (createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } }) as unknown as SupabaseLike) : null
  return real
}
