import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * The service-role client, created on first use rather than at import, so a
 * build without the environment set still compiles and fails only when a
 * request actually needs the database.
 *
 * Both variables are server-only by design. Neither is prefixed NEXT_PUBLIC_,
 * so neither can be inlined into the browser bundle. The service key bypasses
 * RLS, which is exactly why it must never leave the server.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill both in.'
    )
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
