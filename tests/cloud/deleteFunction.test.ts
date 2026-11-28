import { describe, it, expect, vi } from 'vitest'
import { handle, type Deps } from '../../supabase/functions/delete-account/handler'

const deps = (over: Partial<Deps> = {}): Deps => ({
  getUserId: vi.fn(async (jwt: string) => (jwt === 'good' ? 'u1' : null)),
  deleteUser: vi.fn(async () => null),
  ...over,
})
const req = (method: string, headers: Record<string, string> = {}, body?: string) =>
  new Request('https://x.supabase.co/functions/v1/delete-account', { method, headers, body })

describe('delete-account handler', () => {
  it('200 and deletes exactly the verified caller', async () => {
    const d = deps()
    const r = await handle(req('POST', { Authorization: 'Bearer good', Origin: 'https://thebrownizz.github.io' }, JSON.stringify({ id: 'someone-else' })), d)
    expect(r.status).toBe(200)
    expect(d.deleteUser).toHaveBeenCalledWith('u1') // the id from the token, not from the body
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://thebrownizz.github.io')
  })
  it('401 without a token, and nothing is deleted', async () => {
    const d = deps()
    expect((await handle(req('POST'), d)).status).toBe(401)
    expect(d.deleteUser).not.toHaveBeenCalled()
  })
  it('401 for an invalid token or a failing verification', async () => {
    const d = deps()
    expect((await handle(req('POST', { Authorization: 'Bearer bad' }), d)).status).toBe(401)
    const boom = deps({ getUserId: async () => { throw new Error('x') } })
    expect((await handle(req('POST', { Authorization: 'Bearer good' }), boom)).status).toBe(401)
    expect(d.deleteUser).not.toHaveBeenCalled()
  })
  it('500 when the admin delete fails', async () => {
    const d = deps({ deleteUser: async () => ({ message: 'no' }) })
    expect((await handle(req('POST', { Authorization: 'Bearer good' }), d)).status).toBe(500)
  })
  it('answers the CORS preflight; an unknown origin is not echoed back', async () => {
    const d = deps()
    const ok = await handle(req('OPTIONS', { Origin: 'http://localhost:5173' }), d)
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    const evil = await handle(req('OPTIONS', { Origin: 'https://evil.example' }), d)
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBe('https://thebrownizz.github.io')
  })
  it('405 for other methods', async () => {
    expect((await handle(req('GET'), deps())).status).toBe(405)
  })
})
