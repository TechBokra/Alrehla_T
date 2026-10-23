import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminAuthProvider, createGoogleCallbackHandler, GoogleProviderDisabledError, type AuthGateway } from "./auth-provider";
import { googleAuthSettingsSchema } from "@/lib/schema";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isAuthConfigured = Boolean(url && key);
let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!isAuthConfigured) return null;
  client ??= createClient<Database>(url, key, {
    auth: {
      storageKey: "alrehla-admin-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return client;
}

function getGateway(): AuthGateway | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  return {
    startGoogleSignIn: async () => {
      const response = await fetch(new URL("/auth/v1/settings", url), {
        headers: { apikey: key },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Cannot load authentication settings");
      const settings = googleAuthSettingsSchema.parse(await response.json());
      if (!settings.external.google) throw new GoogleProviderDisabledError();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: new URL("/auth/callback", window.location.origin).href,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !data.url) throw error ?? new Error("Missing OAuth destination");
    },
    exchangeCode: async (code) => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    },
    signIn: async (values) => {
      const { data, error } = await supabase.auth.signInWithPassword(values);
      return error
        ? { errorCode: error.status === 0 ? "network_error" : error.code ?? "invalid_credentials" }
        : { userId: data.user?.id };
    },
    getUser: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ? { id: data.user.id, email: data.user.email } : null;
    },
    getProfile: async (userId) => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url, role, archived_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
  };
}

export const adminAuthProvider = createAdminAuthProvider(getGateway);
export const completeGoogleSignIn = createGoogleCallbackHandler(getGateway);
