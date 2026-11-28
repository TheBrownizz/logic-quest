import { describe, it, expect, vi } from 'vitest'
import { RETURN_HASH_KEY, deleteAccount, hasStoredSession, signInWithGoogle, takeRedirectCode } from '../../src/cloud/auth'
import type { SupabaseLike } from '../../src/cloud/types'

function mem(init: Record<string, string> = {}) {
  const m = { ...init }
  return { m, getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v }, removeItem: (k: string) => { delete m[k] } }
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
    await deleteAccount(client, 'u1', st)
    expect(Object.keys(st.m).sort()).toEqual(['logic-quest-save', 'logic-quest-save:u2'])
    expect(signOut).toHaveBeenCalled()
  })
  it('a server failure keeps everything and throws', async () => {
    const st = mem({ 'logic-quest-save:u1': 'a' })
    const client = { functions: { invoke: async () => ({ error: { message: 'no' } }) }, auth: { signOut: vi.fn() } } as unknown as SupabaseLike
    await expect(deleteAccount(client, 'u1', st)).rejects.toThrow('no')
    expect(st.m['logic-quest-save:u1']).toBe('a')
  })
})

describe('hasStoredSession', () => {
  const ls = (keys: string[]) => ({ length: keys.length, key: (i: number) => keys[i] ?? null })
  it('detects a supabase auth token key', () => {
    expect(hasStoredSession(ls(['logic-quest-save', 'sb-abc-auth-token']))).toBe(true)
    expect(hasStoredSession(ls(['logic-quest-save']))).toBe(false)
  })
})
