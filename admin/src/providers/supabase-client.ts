import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { SUPABASE_URL, SUPABASE_KEY } from "./const";

export interface SupabaseConfiguration {
  url?: string;
  publishableKey?: string;
}

// Each application owns one client, including its session and refresh process.
export function createSupabaseConnection(configuration: SupabaseConfiguration) {
  const url = configuration.url?.trim().replace(/\/+$/, "");
  const publishableKey = configuration.publishableKey?.trim();
  const configured = Boolean(url && publishableKey);
  let client: SupabaseClient<Database> | null = null;

  return {
    url,
    publishableKey,
    configured,
    apiUrl: configured ? `${url}/rest/v1` : undefined,
    getClient(): SupabaseClient<Database> | null {
      if (!url || !publishableKey) return null;
      client ??= createClient<Database>(url, publishableKey, {
        auth: {
          storageKey: "alrehla-admin-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      });
      return client;
    },
  };
}

export const supabaseConnection = createSupabaseConnection({
  url: SUPABASE_URL,
  publishableKey: SUPABASE_KEY,
});

export const isAuthConfigured = supabaseConnection.configured;
export const getSupabaseClient = supabaseConnection.getClient;
