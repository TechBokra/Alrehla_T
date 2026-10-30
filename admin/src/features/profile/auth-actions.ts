import { createClient } from "@supabase/supabase-js";
import { supabaseConnection } from "@/providers/supabase-client";
import { currentUser, requireClient } from "./data-provider";
import {
  changePasswordSchema,
  newPasswordSchema,
  recoverySchema,
} from "./model";

const linkKey = "alrehla-google-link-user";
export async function linkGoogle() {
  const user = await currentUser();
  sessionStorage.setItem(linkKey, user.id);
  const { data, error } = await requireClient().auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/link", window.location.origin).href,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    sessionStorage.removeItem(linkKey);
    throw new Error(
      error?.code === "manual_linking_disabled"
        ? "ربط Google غير مفعّل في إعدادات Supabase. تواصل مع مسؤول النظام."
        : "تعذر بدء ربط حساب Google. حاول مرة أخرى.",
    );
  }
}
let linkAttempt: { code: string; result: Promise<void> } | undefined;
export function completeGoogleLink(code?: string, error?: string) {
  if (error || !code) {
    sessionStorage.removeItem(linkKey);
    return Promise.reject(
      new Error("لم يكتمل ربط Google. عد إلى الملف الشخصي وحاول مجددًا."),
    );
  }
  if (linkAttempt?.code === code) return linkAttempt.result;
  const result = (async () => {
    const expectedUser = sessionStorage.getItem(linkKey);
    if (!expectedUser)
      throw new Error("انتهت محاولة الربط. ابدأ الربط من الملف الشخصي مجددًا.");
    try {
      const { error } = await requireClient().auth.exchangeCodeForSession(code);
      if (error) throw new Error("انتهت صلاحية رابط الربط أو استُخدم من قبل.");
      const user = await currentUser();
      if (user.id !== expectedUser) {
        await requireClient().auth.signOut({ scope: "local" });
        throw new Error("لم يطابق الحساب جلسة الربط. سجّل الدخول مجددًا.");
      }
      if (!user.identities?.some((identity) => identity.provider === "google"))
        throw new Error("لم يتم ربط Google بهذا الحساب. حاول مرة أخرى.");
    } finally {
      sessionStorage.removeItem(linkKey);
    }
  })();
  linkAttempt = { code, result };
  return result;
}
export async function changePassword(input: unknown) {
  const values = changePasswordSchema.parse(input);
  const user = await currentUser();
  if (
    !user.email ||
    !supabaseConnection.url ||
    !supabaseConnection.publishableKey
  )
    throw new Error("تعذر التحقق من بريد الحساب.");
  // Verify the existing password without replacing the admin's active session.
  const verifier = createClient(
    supabaseConnection.url,
    supabaseConnection.publishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  try {
    const { data, error } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: values.currentPassword,
    });
    if (error || data.user?.id !== user.id)
      throw new Error("كلمة المرور الحالية غير صحيحة، أو تعذر التحقق منها.");
    const activeUser = await currentUser();
    if (activeUser.id !== user.id)
      throw new Error("تغير الحساب أثناء التحقق. حاول مجددًا.");
    const { error: updateError } = await requireClient().auth.updateUser({
      password: values.password,
      current_password: values.currentPassword,
    });
    if (updateError)
      throw new Error(
        "تعذر تغيير كلمة المرور. تحقق من شروطها أو استخدم رابط إعادة التعيين.",
      );
  } finally {
    await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
export async function sendPasswordReset(email: string) {
  const values = recoverySchema.parse({ email });
  const { error } = await requireClient().auth.resetPasswordForEmail(
    values.email,
    {
      redirectTo: new URL("/reset-password", window.location.origin).href,
    },
  );
  if (error)
    throw new Error("تعذر إرسال الرابط حاليًا. انتظر قليلًا ثم حاول مجددًا.");
}
let recoveryUserId: string | undefined;
let recoveryAttempt: { code: string; result: Promise<void> } | undefined;
export function exchangeRecoveryCode(code?: string, error?: string) {
  if (error || !code)
    return Promise.reject(
      new Error(
        "رابط الاستعادة غير صالح. اطلب رابطًا جديدًا وافتحه في المتصفح الذي طلبته منه.",
      ),
    );
  if (recoveryAttempt?.code === code) return recoveryAttempt.result;
  recoveryUserId = undefined;
  const result = (async () => {
    let recoveryEvent = false;
    const { data: listener } = requireClient().auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") recoveryEvent = true;
      },
    );
    try {
      const { error } = await requireClient().auth.exchangeCodeForSession(code);
      if (error || !recoveryEvent)
        throw new Error(
          "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.",
        );
      recoveryUserId = (await currentUser()).id;
    } finally {
      listener.subscription.unsubscribe();
    }
  })();
  recoveryAttempt = { code, result };
  return result;
}
export async function saveRecoveredPassword(input: unknown) {
  const values = newPasswordSchema.parse(input);
  const user = await currentUser();
  if (!recoveryUserId || user.id !== recoveryUserId)
    throw new Error("تغيرت جلسة الاستعادة. اطلب رابطًا جديدًا.");
  const { error } = await requireClient().auth.updateUser({
    password: values.password,
  });
  if (error)
    throw new Error(
      "تعذر حفظ كلمة المرور. تحقق من شروطها أو اطلب رابطًا جديدًا.",
    );
  recoveryUserId = undefined;
  const { error: signOutError } = await requireClient().auth.signOut({
    scope: "local",
  });
  if (signOutError)
    throw new Error(
      "تم حفظ كلمة المرور، لكن تعذر إنهاء الجلسة. سجّل الخروج يدويًا.",
    );
}
