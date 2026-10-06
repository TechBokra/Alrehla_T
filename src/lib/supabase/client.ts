import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase' // We will create this or use a generic one
import { getSupabasePublicKey, getSupabaseUrl } from './env'

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabasePublicKey()
  )
}
