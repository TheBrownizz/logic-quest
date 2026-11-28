import type { DbError, SaveRow, SupabaseLike } from '../../src/cloud/types'

/** What Postgres jsonb does to stored data: drops undefined, and returns keys in its own order (here: reverse-sorted, never the order written). */
export function jsonb<T>(v: T): T {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort)
    if (typeof x === 'object' && x !== null) return Object.fromEntries(Object.keys(x).sort().reverse().map(k => [k, sort((x as Record<string, unknown>)[k])]))
    return x
  }
  return sort(JSON.parse(JSON.stringify(v))) as T
}

/** In-memory stand-in for Supabase: a `saves` table with `rev`, no network. */
export class FakeSupabase {
  rows = new Map<string, SaveRow>()
  /** Next table call fails with this error (one-shot per queued entry). */
  failures: DbError[] = []
  /** Runs right before each update is applied: simulates another device writing in between. */
  beforeUpdate: (() => void) | null = null
  /** Awaited at the start of each call, so a test can hold a request in flight. */
  gates: { select?: () => Promise<void>; update?: () => Promise<void>; upsert?: () => Promise<void> } = {}
  calls = { select: 0, upsert: 0, update: 0 }

  /** Another device writes `data` directly, bumping rev. */
  concurrentWrite(userId: string, data: unknown): void {
    const r = this.rows.get(userId)
    this.rows.set(userId, { data, rev: (r?.rev ?? 0) + 1 })
  }
  private fail(): DbError | null { return this.failures.shift() ?? null }

  client(): SupabaseLike {
    const self = this
    return {
      from: () => ({
        select: () => ({
          eq: (_c, id) => ({
            async maybeSingle() {
              self.calls.select++
              await self.gates.select?.()
              const error = self.fail()
              if (error) return { data: null, error }
              const r = self.rows.get(id)
              return { data: r ? { data: jsonb(r.data), rev: r.rev } : null, error: null }
            },
          }),
        }),
        async upsert(row, opts) {
          self.calls.upsert++
          await self.gates.upsert?.()
          const error = self.fail()
          if (error) return { error }
          if (!(opts.ignoreDuplicates && self.rows.has(row.user_id))) self.rows.set(row.user_id, { data: jsonb(row.data), rev: row.rev })
          return { error: null }
        },
        update: values => ({
          eq: (_c, id) => ({
            eq: (_r, rev) => ({
              async select() {
                self.calls.update++
                await self.gates.update?.()
                const error = self.fail()
                if (error) return { data: null, error }
                self.beforeUpdate?.()
                const r = self.rows.get(id)
                if (!r || r.rev !== rev) return { data: [], error: null }
                self.rows.set(id, { data: jsonb(values.data), rev: values.rev })
                return { data: [{ rev: values.rev }], error: null }
              },
            }),
          }),
        }),
      }),
      auth: {} as SupabaseLike['auth'],
      functions: {} as SupabaseLike['functions'],
    }
  }
}
