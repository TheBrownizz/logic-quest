import { describe, it, expect, vi } from 'vitest'
import { RETURN_HASH_KEY, SIGNED_OUT_KEY, deleteAccount, sessionKeys, hasStoredSession, signInWithGoogle, signOut, takeRedirectCode, withTimeout } from '../../src/cloud/auth'
import type { SupabaseLike } from '../../src/cloud/types'

function mem(init: Record<string, string> = {}) {
  const m = { ...init }
  return { m, get length() { return Object.keys(m).length }, key: (i: number) => Object.keys(m)[i] ?? null, getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v }, removeItem: (k: string) => { delete m[k] } }
}
const loc = (search: string, hash: string) => ({ origin: 'https://x.github.io', pathname: '/logic-quest/', search, hash })

describe('takeRedirectCode (Review Focus 4)', () => {
  it('?code= plus a remembered hash: the query is removed and the hash restored', () => {
    const st = mem({ [RETURN_HASH_KEY]: '#/room/sw-1-r5' })
    const replace = vi.fn()
    const code = takeRedirectCode(loc('?code=abc123', ''), { replaceState: replace }, st)
    expect(code).toBe('abc123')
    expect(replace).toHaveBeenCalledWith(null, '', '/logic-quest/#/room/sw-1-r5')
    expect(RETURN_HASH_KEY in st.m).toBe(false)
  })
  it('keeps unrelated query params; falls back to the current hash', () => {
    const replace = vi.fn()
    takeRedirectCode(loc('?a=1&code=zz', '#/collection'), { replaceState: replace }, mem())
    expect(replace).toHaveBeenCalledWith(null, '', '/logic-quest/?a=1#/collection')
  })
  it('an OAuth error return is cleaned up too, with no code', () => {
    const replace = vi.fn()
    expect(takeRedirectCode(loc('?error=access_denied&error_description=x', ''), { replaceState: replace }, mem())).toBeNull()
    expect(replace).toHaveBeenCalledWith(null, '', '/logic-quest/')
  })
  it('an ordinary page load touches nothing', () => {
    const replace = vi.fn()
    expect(takeRedirectCode(loc('', '#/x'), { replaceState: replace }, mem({ [RETURN_HASH_KEY]: '#/old' }))).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('signInWithGoogle', () => {
  it('stores the hash, then asks for Google with the page as redirect target', async () => {
    const st = mem()
    const signInWithOAuth = vi.fn(async () => ({ error: null }))
    const client = { auth: { signInWithOAuth } } as unknown as SupabaseLike
    await signInWithGoogle(client, loc('', '#/room/sw-1-r1'), st)
    expect(st.m[RETURN_HASH_KEY]).toBe('#/room/sw-1-r1')
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://x.github.io/logic-quest/' } })
  })
})

describe('deleteAccount', () => {
  it('invokes the function, clears only this user\'s local save, signs out', async () => {
    const st = mem({ 'logic-quest-save:u1': 'a', 'logic-quest-save:u1-backup': 'b', 'logic-quest-save': 'guest', 'logic-quest-save:u2': 'c' })
    const signOut = vi.fn(async () => ({ error: null }))
    const client = { functions: { invoke: vi.fn(async () => ({ error: null })) }, auth: { signOut } } as unknown as SupabaseLike
    await deleteAccount(client, 'u1', st, [])
    expect(Object.keys(st.m).sort()).toEqual(['logic-quest-save', 'logic-quest-save:u2', SIGNED_OUT_KEY].sort())
    expect(signOut).toHaveBeenCalled()
  })
  it('a server failure keeps everything and throws', async () => {
    const st = mem({ 'logic-quest-save:u1': 'a' })
    const client = { functions: { invoke: async () => ({ error: { message: 'no' } }) }, auth: { signOut: vi.fn() } } as unknown as SupabaseLike
    await expect(deleteAccount(client, 'u1', st)).rejects.toThrow('no')
    expect(st.m['logic-quest-save:u1']).toBe('a')
  })
})

describe('signOut (C1: signing out must work offline)', () => {
  it('asks for a local sign-out', async () => {
    const so = vi.fn(async () => ({ error: null }))
    await signOut({ auth: { signOut: so } } as unknown as SupabaseLike, mem())
    expect(so).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('when signOut returns an error, the stored session is still removed (a reload does not bring the account back)', async () => {
    const st = mem({ 'sb-abc-auth-token': '{"user":1}', 'sb-abc-auth-token-code-verifier': 'v', 'logic-quest-save:u1': 'a', 'logic-quest-save': 'g' })
    const client = { auth: { signOut: async () => ({ error: { message: 'Failed to fetch' } }) } } as unknown as SupabaseLike
    await expect(signOut(client, st, ['sb-abc-auth-token', 'sb-abc-auth-token-code-verifier'])).resolves.toBeUndefined()
    expect(Object.keys(st.m).sort()).toEqual(['logic-quest-save', 'logic-quest-save:u1', SIGNED_OUT_KEY].sort())
    expect(hasStoredSession(st, ['sb-abc-auth-token'])).toBe(false)
  })
  it('when signOut throws, the stored session is still removed', async () => {
    const st = mem({ 'sb-abc-auth-token': 'x' })
    await signOut({ auth: { signOut: async () => { throw new Error('offline') } } } as unknown as SupabaseLike, st, ['sb-abc-auth-token'])
    expect(hasStoredSession(st, ['sb-abc-auth-token'])).toBe(false)
  })
  it('deleteAccount: a failing sign-out after the server deleted the account is not an error', async () => {
    const st = mem({ 'sb-abc-auth-token': 'x', 'logic-quest-save:u1': 'a' })
    const client = { functions: { invoke: async () => ({ error: null }) }, auth: { signOut: async () => ({ error: { message: 'net' } }) } } as unknown as SupabaseLike
    await expect(deleteAccount(client, 'u1', st)).resolves.toBeUndefined()
    expect(st.m['logic-quest-save:u1']).toBeUndefined()
    expect(hasStoredSession(st)).toBe(false)
  })
})

describe('withTimeout (M9)', () => {
  it('rejects a call that hangs, resolves one that answers', async () => {
    vi.useFakeTimers()
    const hung = withTimeout(new Promise<never>(() => {}), 10000)
    const caught = hung.catch(e => (e as Error).message)
    await vi.advanceTimersByTimeAsync(10001)
    expect(await caught).toBe('timeout')
    expect(await withTimeout(Promise.resolve(5), 10000)).toBe(5)
    vi.useRealTimers()
  })
})

describe('sessionKeys and hasStoredSession (exact keys from the project URL)', () => {
  const KEYS = ['sb-abcdef-auth-token', 'sb-abcdef-auth-token-code-verifier']
  it('derives the keys from the first label of the host', () => {
    expect(sessionKeys('https://abcdef.supabase.co', [])).toEqual(KEYS)
    expect(sessionKeys(undefined, [])).toEqual([])
    expect(sessionKeys('not a url', [])).toEqual([])
  })
  it('detects only this project\'s session', () => {
    expect(hasStoredSession(mem({ 'sb-abcdef-auth-token': '{}' }), KEYS)).toBe(true)
    expect(hasStoredSession(mem({ 'sb-someone-else-auth-token': '{}', 'logic-quest-save': 'x' }), KEYS)).toBe(false)
  })
  it('signOut removes exactly this project\'s keys, leaves other apps on the same origin alone, and pings other tabs', async () => {
    const st = mem({ ...Object.fromEntries(KEYS.map(k => [k, 'x'])), 'sb-otherapp-auth-token': 'keep', 'logic-quest-save': 'g' })
    await signOut({ auth: { signOut: async () => ({ error: { message: 'net' } }) } } as unknown as SupabaseLike, st, KEYS)
    expect(Object.keys(st.m).sort()).toEqual(['logic-quest-save', 'sb-otherapp-auth-token', SIGNED_OUT_KEY].sort())
  })
})
