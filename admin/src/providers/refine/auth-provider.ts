import type { AuthProvider } from "@refinedev/core";
import type { Database } from "@/types/supabase";
import {
  getSupabaseClient,
  supabaseConnection,
} from "@/providers/supabase-client";
import {
  googleAuthSettingsSchema,
  googleSignInSchema,
  signInSchema,
  type SignInValues,
} from "@/lib/schema";

export type { AdminLoginValues, SignInValues } from "@/lib/schema";

export interface AdminAuthorization {
  id: string;
  role: "super_admin" | "general_supervisor";
  permissions: string[];
}

export class GoogleProviderDisabledError extends Error {}
type AdminProfile = Pick<
  Database["public"]["Tables"]["user_profiles"]["Row"],
  "id" | "full_name" | "avatar_url" | "role" | "archived_at" | "admin_role_id"
>;

interface AuthGateway {
  signIn(
    values: SignInValues,
  ): Promise<{ userId?: string; errorCode?: string }>;
  startGoogleSignIn(): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  getUser(): Promise<{ id: string; email?: string } | null>;
  getProfile(userId: string): Promise<AdminProfile | null>;
  getPermissions(adminRoleId: string | null): Promise<string[]>;
  signOut(): Promise<void>;
}

const connectionMessage = "تعذّر الاتصال بخدمة تسجيل الدخول. حاول مرة أخرى.";
const authConfigurationMessage =
  "تسجيل الدخول غير متاح حاليًا. راجع إعدادات اتصال لوحة الإدارة.";

function authFailure(message: string) {
  return { success: false, error: { name: "تعذّر تسجيل الدخول", message } };
}

function isAdminProfile(profile: AdminProfile | null): profile is AdminProfile {
  return Boolean(
    profile &&
      !profile.archived_at &&
      (profile.role === "super_admin" || profile.role === "general_supervisor"),
  );
}

async function isEligibleAdmin(gateway: AuthGateway) {
  const user = await gateway.getUser();
  const profile = user ? await gateway.getProfile(user.id) : null;
  return isAdminProfile(profile);
}

function credentialErrorMessage(code: string) {
  if (code === "email_not_confirmed")
    return "أكّد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (code === "over_request_rate_limit")
    return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (code === "network_error") return connectionMessage;
  return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
}

export function createAdminAuthProvider(getGateway: () => AuthGateway | null, now = Date.now) {
  type Session = {
    user: { id: string; email?: string };
    profile: AdminProfile;
  };
  let version = 0;
  let epoch = 0;
  let accessCache: { value: AdminAuthorization; expiresAt: number } | undefined;
  let accessPending: Promise<AdminAuthorization | null> | undefined;
  let cached: { session: Session; expiresAt: number } | undefined;
  let pending: Promise<Session | null> | undefined;
  const listeners = new Set<() => void>();

  function invalidateSession() {
    version++;
    epoch++;
    accessCache = undefined;
    accessPending = undefined;
    cached = undefined;
    pending = undefined;
    listeners.forEach((listener) => listener());
  }

  async function readSession(): Promise<Session | null> {
    if (cached && now() < cached.expiresAt) return cached.session;
    if (pending) return pending;
    const gateway = getGateway();
    if (!gateway) return null;
    const startedVersion = version;
    const startedEpoch = epoch;
    const request = (async () => {
      const user = await gateway.getUser();
      if (!user || (version !== startedVersion || epoch !== startedEpoch)) return null;
      const profile = await gateway.getProfile(user.id);
      if ((version !== startedVersion || epoch !== startedEpoch) || !isAdminProfile(profile)) return null;
      const session = { user, profile };
      cached = { session, expiresAt: now() + 60_000 };
      return session;
    })();
    pending = request;
    try {
      return await request;
    } finally {
      if (pending === request) pending = undefined;
    }
  }

  async function getAuthorization(refresh = false): Promise<AdminAuthorization | null> {
    if (refresh) {
      epoch++;
      cached = undefined;
      pending = undefined;
      accessCache = undefined;
      accessPending = undefined;
    }
    if (accessCache && now() < accessCache.expiresAt) return accessCache.value;
    if (accessPending) return accessPending;
    const startedEpoch = epoch;
    const request = (async () => {
      const session = await readSession();
      if (!session || epoch !== startedEpoch) return null;
      const gateway = getGateway();
      if (!gateway) return null;
      const permissions = session.profile.role === "super_admin"
        ? []
        : await gateway.getPermissions(session.profile.admin_role_id);
      if (epoch !== startedEpoch) return null;
      const value: AdminAuthorization = {
        id: session.user.id,
        role: session.profile.role as AdminAuthorization["role"],
        permissions,
      };
      accessCache = { value, expiresAt: cached?.expiresAt ?? now() };
      return value;
    })();
    accessPending = request;
    try {
      return await request;
    } finally {
      if (accessPending === request) accessPending = undefined;
    }
  }

  return {
    getAuthorization,
    invalidateSession,
    getSessionVersion: () => version,
    subscribeSession: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    login: async (values: unknown) => {
      invalidateSession();
      if (
        typeof values === "object" &&
        values !== null &&
        "providerName" in values
      ) {
        if (!googleSignInSchema.safeParse(values).success)
          return authFailure("طريقة تسجيل الدخول غير مدعومة.");
        const gateway = getGateway();
        if (!gateway) return authFailure(authConfigurationMessage);
        try {
          await gateway.startGoogleSignIn();
          return { success: true };
        } catch (error) {
          if (error instanceof GoogleProviderDisabledError) {
            return authFailure(
              "تسجيل الدخول باستخدام Google غير مفعّل حاليًا. تواصل مع مسؤول المنصة أو استخدم كلمة المرور.",
            );
          }
          return authFailure(
            "تعذّر فتح تسجيل الدخول باستخدام Google. حاول مرة أخرى أو استخدم كلمة المرور.",
          );
        }
      }
      const parsed = signInSchema.safeParse(values);
      if (!parsed.success) return authFailure(parsed.error.issues[0].message);
      const gateway = getGateway();
      if (!gateway) return authFailure(authConfigurationMessage);
      let signedIn = false;
      try {
        const result = await gateway.signIn(parsed.data);
        if (result.errorCode || !result.userId) {
          return authFailure(
            credentialErrorMessage(result.errorCode ?? "invalid_credentials"),
          );
        }
        signedIn = true;
        const profile = await gateway.getProfile(result.userId);
        if (!isAdminProfile(profile)) {
          await gateway.signOut();
          return authFailure("هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة.");
        }
        return { success: true, redirectTo: "/" };
      } catch {
        if (signedIn) await gateway.signOut().catch(() => undefined);
        return authFailure(connectionMessage);
      }
    },
    check: async () => {
      try {
        if (await readSession()) return { authenticated: true };
      } catch {
        // Deny access if the verified user or admin profile cannot be loaded.
      }
      return { authenticated: false, redirectTo: "/sign-in" };
    },
    logout: async () => {
      invalidateSession();
      const gateway = getGateway();
      if (!gateway) return authFailure(authConfigurationMessage);
      try {
        await gateway.signOut();
        return { success: true, redirectTo: "/sign-in" };
      } catch {
        return authFailure("تعذّر تسجيل الخروج. حاول مرة أخرى.");
      }
    },
    getIdentity: async () => {
      const session = await readSession();
      if (!session) return null;
      const { user, profile } = session;
      return {
        id: profile.id,
        name: profile.full_name,
        email: user.email,
        avatar: profile.avatar_url,
        role: profile.role,
      };
    },
    onError: async () => ({}),
  };
}

function createGoogleCallbackHandler(getGateway: () => AuthGateway | null) {
  type LoginResponse = Awaited<ReturnType<AuthProvider["login"]>>;
  let previous: { code: string; result: Promise<LoginResponse> } | undefined;

  async function complete(code: string): Promise<LoginResponse> {
    const gateway = getGateway();
    if (!gateway) return authFailure(authConfigurationMessage);
    let exchanged = false;
    try {
      await gateway.exchangeCode(code);
      exchanged = true;
      if (!(await isEligibleAdmin(gateway))) {
        await gateway.signOut();
        return authFailure("هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة.");
      }
      return { success: true, redirectTo: "/" };
    } catch {
      if (exchanged) await gateway.signOut().catch(() => undefined);
      return authFailure(
        "تعذّر إكمال تسجيل الدخول باستخدام Google. ارجع إلى صفحة الدخول وحاول مرة أخرى.",
      );
    }
  }

  return (params: { code?: string; error?: string }): Promise<LoginResponse> => {
    if (params.error)
      return Promise.resolve(
        authFailure("لم يكتمل تسجيل الدخول باستخدام Google. يمكنك المحاولة مرة أخرى."),
      );
    const code = params.code;
    if (!code)
      return Promise.resolve(
        authFailure("رابط تسجيل الدخول غير صالح أو انتهت صلاحيته. حاول تسجيل الدخول مرة أخرى."),
      );
    if (previous?.code === code) return previous.result;
    const result = complete(code);
    previous = { code, result };
    return result;
  };
}

function getAuthGateway(): AuthGateway | null {
  const supabase = getSupabaseClient();
  const { url, publishableKey } = supabaseConnection;
  if (!supabase || !url || !publishableKey) return null;
  return {
    startGoogleSignIn: async () => {
      const response = await fetch(new URL("/auth/v1/settings", url), {
        headers: { apikey: publishableKey },
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
      if (error || !data.url)
        throw error ?? new Error("Missing OAuth destination");
    },
    exchangeCode: async (code) => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    },
    signIn: async (values: SignInValues) => {
      const { data, error } = await supabase.auth.signInWithPassword(values);
      return error
        ? {
            errorCode:
              error.status === 0
                ? "network_error"
                : (error.code ?? "invalid_credentials"),
          }
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
        .select("id, full_name, avatar_url, role, archived_at, admin_role_id")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    getPermissions: async (adminRoleId) => {
      let query = supabase.from("admin_roles").select("permissions");
      query = adminRoleId ? query.eq("id", adminRoleId) : query.eq("is_default", true);
      const { data, error } = await query.maybeSingle();
      if (error || !data) throw new Error("تعذّر تحميل صلاحيات الحساب. حاول مرة أخرى.");
      return data.permissions;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
  };
}

export const adminAuthProvider = createAdminAuthProvider(getAuthGateway);
export const completeGoogleSignIn = createGoogleCallbackHandler(getAuthGateway);

// Invalidate the same auth adapter used by route guards and Refine identity.
let sessionToken: string | undefined;
const sessionSubscription = getSupabaseClient()?.auth.onAuthStateChange(
  (event, session) => {
    const nextToken = session?.access_token;
    const changed = nextToken !== sessionToken;
    sessionToken = nextToken;
    if (event === "INITIAL_SESSION") return;
    if (changed || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      adminAuthProvider.invalidateSession();
    }
  },
);
if (import.meta.hot) {
  import.meta.hot.dispose(() =>
    sessionSubscription?.data.subscription.unsubscribe(),
  );
}

