import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseFetch } from './env'

export function createClient() {
  const customFetch = getSupabaseFetch()
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      global: customFetch ? { fetch: customFetch } : undefined,
    }
  )
}

