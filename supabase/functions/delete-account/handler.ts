// The logic of the delete-account function, kept free of Deno and SDK imports so it can be unit-tested.
// index.ts wires it to Supabase.

export const ALLOWED_ORIGINS = ['https://thebrownizz.github.io', 'http://localhost:5173']

export interface Deps {
  /** Verifies the caller's JWT with the anon client: the user's id, or null when the token is not valid. */
  getUserId(jwt: string): Promise<string | null>
  /** Deletes the user with the admin client (service role key, from the function's environment). */
  deleteUser(id: string): Promise<{ message: string } | null>
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** 204 for the CORS preflight; 401 without a valid JWT; 200 once the calling user (and only them) is deleted. */
export async function handle(req: Request, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, cors)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json(401, { error: 'missing token' }, cors)
  let id: string | null = null
  try { id = await deps.getUserId(jwt) } catch { id = null }
  if (!id) return json(401, { error: 'invalid token' }, cors)
  const err = await deps.deleteUser(id) // the id comes from the verified token, never from the request body
  if (err) return json(500, { error: 'delete failed' }, cors)
  return json(200, { ok: true }, cors)
}
