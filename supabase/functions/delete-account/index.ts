// Supabase Edge Function (Deno): deletes the calling user's account. The saves row goes with it ("on delete cascade").
// Deploy: npx supabase functions deploy delete-account   (see docs/SETUP-ACCOUNTS.md)
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function.
// The service role key lives only in the function's environment: it is never in this repository or in the site.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handle } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(req => handle(req, {
  async getUserId(jwt) {
    const { data, error } = await createClient(url, anon).auth.getUser(jwt)
    return error || !data.user ? null : data.user.id
  },
  async deleteUser(id) {
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await admin.auth.admin.deleteUser(id)
    return error ? { message: error.message } : null
  },
}))
