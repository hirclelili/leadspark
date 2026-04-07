import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create API client with service role key (no cookies needed)
export function createApiClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
