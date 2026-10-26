import type { AuthProvider } from "@refinedev/core";
import type { Database } from "@/types/supabase";
import {
  signInSchema,
  googleSignInSchema,
  type SignInValues,
} from "@/lib/schema";

export type { SignInValues, AdminLoginValues } from "@/lib/schema";
export class GoogleProviderDisabledError extends Error {}
export type AdminProfile = Pick<
  Database["public"]["Tables"]["user_profiles"]["Row"],
  "id" | "full_name" | "avatar_url" | "role" | "archived_at"
>;

export interface AuthGateway {
  signIn(
    values: SignInValues,
  ): Promise<{ userId?: string; errorCode?: string }>;
  startGoogleSignIn(): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  getUser(): Promise<{ id: string; email?: string } | null>;
  getProfile(userId: string): Promise<AdminProfile | null>;
  signOut(): Promise<void>;
}

const connectionMessage = "تعذّر الاتصال بخدمة تسجيل الدخول. حاول مرة أخرى.";
export const authConfigurationMessage =
  "تسجيل الدخول غير متاح حاليًا. راجع إعدادات اتصال لوحة الإدارة.";

function failure(message: string) {
  return { success: false, error: { name: "تعذّر تسجيل الدخول", message } };
}

function isAdmin(profile: AdminProfile | null): profile is AdminProfile {
  return Boolean(
    profile &&
    !profile.archived_at &&
    (profile.role === "super_admin" || profile.role === "general_supervisor"),
  );
}

async function validateAdminSession(gateway: AuthGateway) {
  const user = await gateway.getUser();
  const profile = user ? await gateway.getProfile(user.id) : null;
  return isAdmin(profile);
}

function credentialMessage(code: string) {
  if (code === "email_not_confirmed")
    return "أكّد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (code === "over_request_rate_limit")
    return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (code === "network_error") return connectionMessage;
  return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
}

export function createAdminAuthProvider(
  getGateway: () => AuthGateway | null,
  now = Date.now,
): AuthProvider & {
  invalidateSession(): void;
  subscribeSession(listener: () => void): () => void;
  getSessionVersion(): number;
} {
  type Session = { user: { id: string; email?: string }; profile: AdminProfile };
  let version = 0;
  let cached: { session: Session; expiresAt: number } | undefined;
  let pending: Promise<Session | null> | undefined;
  const listeners = new Set<() => void>();

  function invalidateSession() {
    version++;
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
    const request = (async () => {
      const user = await gateway.getUser();
      if (!user || version !== startedVersion) return null;
      const profile = await gateway.getProfile(user.id);
      if (version !== startedVersion || !isAdmin(profile)) return null;
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

  return {
    invalidateSession,
    getSessionVersion: () => version,
    subscribeSession: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    login: async (values: unknown) => {
      invalidateSession();
      if (
        typeof values === "object" &&
        values !== null &&
        "providerName" in values
      ) {
        if (!googleSignInSchema.safeParse(values).success)
          return failure("طريقة تسجيل الدخول غير مدعومة.");
        const gateway = getGateway();
        if (!gateway) return failure(authConfigurationMessage);
        try {
          await gateway.startGoogleSignIn();
          // The browser is leaving for Google; access is checked after the code exchange.
          return { success: true };
        } catch (error) {
          if (error instanceof GoogleProviderDisabledError) {
            return failure(
              "تسجيل الدخول باستخدام Google غير مفعّل حاليًا. تواصل مع مسؤول المنصة أو استخدم كلمة المرور.",
            );
          }
          return failure(
            "تعذّر فتح تسجيل الدخول باستخدام Google. حاول مرة أخرى أو استخدم كلمة المرور.",
          );
        }
      }
      const parsed = signInSchema.safeParse(values);
      if (!parsed.success) return failure(parsed.error.issues[0].message);
      const gateway = getGateway();
      if (!gateway) return failure(authConfigurationMessage);

      let signedIn = false;
      try {
        const result = await gateway.signIn(parsed.data);
        if (result.errorCode || !result.userId) {
          return failure(
            credentialMessage(result.errorCode ?? "invalid_credentials"),
          );
        }
        signedIn = true;
        const profile = await gateway.getProfile(result.userId);
        if (!isAdmin(profile)) {
          await gateway.signOut();
          return failure("هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة.");
        }
        return { success: true, redirectTo: "/theme" };
      } catch {
        // A profile lookup failure must not leave a newly accepted login behind.
        if (signedIn) await gateway.signOut().catch(() => undefined);
        return failure(connectionMessage);
      }
    },
    check: async () => {
      try {
        if (await readSession())
          return { authenticated: true };
      } catch {
        // Deny access if either the verified user or profile cannot be loaded.
      }
      return { authenticated: false, redirectTo: "/sign-in" };
    },
    logout: async () => {
      invalidateSession();
      const gateway = getGateway();
      if (!gateway) return failure(authConfigurationMessage);
      try {
        await gateway.signOut();
        return { success: true, redirectTo: "/sign-in" };
      } catch {
        return failure("تعذّر تسجيل الخروج. حاول مرة أخرى.");
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
      };
    },
    onError: async () => ({}),
  };
}

export function createGoogleCallbackHandler(
  getGateway: () => AuthGateway | null,
) {
  type LoginResponse = Awaited<ReturnType<AuthProvider["login"]>>;
  let previous: { code: string; result: Promise<LoginResponse> } | undefined;

  async function complete(code: string): Promise<LoginResponse> {
    const gateway = getGateway();
    if (!gateway) return failure(authConfigurationMessage);
    let exchanged = false;
    try {
      await gateway.exchangeCode(code);
      exchanged = true;
      if (!(await validateAdminSession(gateway))) {
        await gateway.signOut();
        return failure("هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة.");
      }
      return { success: true, redirectTo: "/theme" };
    } catch {
      if (exchanged) await gateway.signOut().catch(() => undefined);
      return failure(
        "تعذّر إكمال تسجيل الدخول باستخدام Google. ارجع إلى صفحة الدخول وحاول مرة أخرى.",
      );
    }
  }

  return (params: {
    code?: string;
    error?: string;
  }): Promise<LoginResponse> => {
    if (params.error)
      return Promise.resolve(
        failure(
          "لم يكتمل تسجيل الدخول باستخدام Google. يمكنك المحاولة مرة أخرى.",
        ),
      );
    const code = params.code;
    if (!code)
      return Promise.resolve(
        failure(
          "رابط تسجيل الدخول غير صالح أو انتهت صلاحيته. حاول تسجيل الدخول مرة أخرى.",
        ),
      );
    // OAuth codes are single use. Router invalidation must not exchange the same code twice.
    if (previous?.code === code) return previous.result;
    const result = complete(code);
    previous = { code, result };
    return result;
  };
}
