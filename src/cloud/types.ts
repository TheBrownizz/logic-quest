/** The minimal slice of the Supabase client the game uses. The real client and the test fake both fit it. */
export interface DbError { message: string }
export interface SaveRow { data: unknown; rev: number }
export interface Res<T> { data: T; error: DbError | null }

export interface SavesTable {
  select(cols: string): { eq(col: 'user_id', id: string): { maybeSingle(): PromiseLike<Res<SaveRow | null>> } }
  /** `insert ... on conflict do nothing` when `ignoreDuplicates` is true. */
  upsert(row: { user_id: string; data: unknown; rev: number }, opts: { onConflict: string; ignoreDuplicates: boolean }): PromiseLike<{ error: DbError | null }>
  update(values: { data: unknown; rev: number }): {
    eq(col: 'user_id', id: string): { eq(col: 'rev', rev: number): { select(cols: string): PromiseLike<Res<{ rev: number }[] | null>> } }
  }
}

export interface SupabaseUser { id: string; email?: string; user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string } }
export interface SupabaseSession { user: SupabaseUser }

export interface SupabaseLike {
  auth: {
    getSession(): PromiseLike<{ data: { session: SupabaseSession | null }; error?: DbError | null }>
    onAuthStateChange(cb: (event: string, session: SupabaseSession | null) => void): { data: { subscription: { unsubscribe(): void } } }
    signInWithOAuth(args: { provider: 'google'; options?: { redirectTo?: string } }): PromiseLike<{ error: DbError | null }>
    exchangeCodeForSession(code: string): PromiseLike<{ error: DbError | null }>
    signOut(): PromiseLike<{ error: DbError | null }>
  }
  from(table: 'saves'): SavesTable
  functions: { invoke(name: string): PromiseLike<{ error: DbError | null }> }
}
