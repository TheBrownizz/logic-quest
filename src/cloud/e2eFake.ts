import type { SaveRow, SupabaseLike, SupabaseSession } from './types'

/**
 * An in-browser stand-in for Supabase used only by the end-to-end tests. It is reached only through a branch
 * guarded by the build-time flag VITE_E2E_FAKE=1 (see client.ts), so a normal production build drops it.
 * Rows and the session live in localStorage, so reloads and several tabs behave like a real backend.
 * "Google" is simulated: signInWithOAuth returns to this page with `?code=fake-<id>`, where <id> comes from
 * localStorage `lq-fake:next-user` (default u1).
 */
const ROWS = 'lq-fake:saves'
const SESSION = 'sb-fake-auth-token'
const NEXT = 'lq-fake:next-user'

const readRows = (): Record<string, SaveRow> => { try { return JSON.parse(localStorage.getItem(ROWS) ?? '{}') } catch { return {} } }
const writeRows = (r: Record<string, SaveRow>): void => localStorage.setItem(ROWS, JSON.stringify(r))
const readSession = (): SupabaseSession | null => { try { return JSON.parse(localStorage.getItem(SESSION) ?? 'null') } catch { return null } }

function sessionFor(id: string): SupabaseSession {
  return { user: { id, email: `${id}@example.com`, user_metadata: { full_name: `משתמש ${id}` } } }
}

export function createE2eFake(): SupabaseLike {
  const listeners = new Set<(e: string, s: SupabaseSession | null) => void>()
  const emit = (e: string, s: SupabaseSession | null) => listeners.forEach(cb => cb(e, s))
  return {
    auth: {
      getSession: async () => ({ data: { session: readSession() } }),
      onAuthStateChange(cb) {
        listeners.add(cb)
        return { data: { subscription: { unsubscribe: () => { listeners.delete(cb) } } } }
      },
      async signInWithOAuth({ options }) {
        const id = localStorage.getItem(NEXT) || 'u1'
        const target = options?.redirectTo ?? location.origin + location.pathname
        location.assign(`${target}?code=fake-${encodeURIComponent(id)}`)
        return { error: null }
      },
      async exchangeCodeForSession(code) {
        if (!code.startsWith('fake-')) return { error: { message: 'bad code' } }
        const s = sessionFor(decodeURIComponent(code.slice(5)))
        localStorage.setItem(SESSION, JSON.stringify(s))
        emit('SIGNED_IN', s)
        return { error: null }
      },
      async signOut() {
        localStorage.removeItem(SESSION)
        emit('SIGNED_OUT', null)
        return { error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: (_c, id) => ({
          async maybeSingle() {
            const r = readRows()[id]
            return { data: r ? JSON.parse(JSON.stringify(r)) : null, error: null }
          },
        }),
      }),
      async upsert(row, opts) {
        const rows = readRows()
        if (!(opts.ignoreDuplicates && rows[row.user_id])) rows[row.user_id] = { data: row.data, rev: row.rev }
        writeRows(rows)
        return { error: null }
      },
      update: values => ({
        eq: (_c, id) => ({
          eq: (_r, rev) => ({
            async select() {
              const rows = readRows()
              if (!rows[id] || rows[id].rev !== rev) return { data: [], error: null }
              rows[id] = { data: values.data, rev: values.rev }
              writeRows(rows)
              return { data: [{ rev: values.rev }], error: null }
            },
          }),
        }),
      }),
    }),
    functions: {
      async invoke() {
        const s = readSession()
        if (!s) return { error: { message: 'not signed in' } }
        const rows = readRows()
        delete rows[s.user.id]
        writeRows(rows)
        return { error: null }
      },
    },
  }
}
