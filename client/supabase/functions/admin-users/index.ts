import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  ADMIN_USER_ROLES,
  ASSIGNABLE_USER_ROLES,
  canAssignUserRole,
  canChangeUserRole,
  canDeleteUserAccount,
  canSuspendUserAccount,
  isActiveUsersAdmin,
} from "./policy.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const roles = ASSIGNABLE_USER_ROLES;
const adminRoles = ADMIN_USER_ROLES;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Failure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type JsonObject = Record<string, unknown>;
type Actor = { id: string; name: string; role: string };

function safeJson(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function slugFromName(value: string) {
  const slug = value.trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `publisher-${Date.now()}`;
}

async function insertAudit(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  action: string,
  id: string,
  metadata: JsonObject,
) {
  const { error } = await service.from("audit_logs").insert({
    actor_profile_id: actor.id,
    action,
    entity_type: "UserProfile",
    entity_id: id,
    metadata,
  });
  if (error) console.error("admin-users audit write failed", error.code ?? error.name);
}

async function ensurePublisher(
  service: ReturnType<typeof createClient>,
  id: string,
  fullName: string,
) {
  const { data: existing, error: readError } = await service
    .from("publishers").select("id").eq("user_id", id).maybeSingle();
  if (readError) throw new Failure(503, "تعذر تجهيز ملف دار النشر.");
  if (existing) return;

  const name = fullName.trim() || "دار نشر";
  const base = slugFromName(name);
  let slug = base;
  for (let suffix = 2; suffix < 50; suffix++) {
    const { data: taken, error } = await service
      .from("publishers").select("id").eq("slug", slug).maybeSingle();
    if (error) throw new Failure(503, "تعذر تجهيز ملف دار النشر.");
    if (!taken) break;
    slug = `${base}-${suffix}`;
  }
  const { error } = await service.from("publishers").insert({
    user_id: id,
    name,
    slug,
    bio: "",
    status: "active",
  });
  if (error) throw new Failure(503, "تعذر تجهيز ملف دار النشر.");
}

async function ensureProvider(
  service: ReturnType<typeof createClient>,
  id: string,
  fullName: string,
) {
  const { data: existing, error: readError } = await service
    .from("service_providers").select("id").eq("user_id", id).maybeSingle();
  if (readError) throw new Failure(503, "تعذر تجهيز ملف مقدّم الخدمة.");
  if (existing) return;
  const { error } = await service.from("service_providers").insert({
    kind: "individual",
    user_id: id,
    display_name: fullName.trim() || "مقدّم خدمة",
    bio: "",
    status: "pending",
    is_public: false,
  });
  if (error) throw new Failure(503, "تعذر تجهيز ملف مقدّم الخدمة.");
}

async function ensureRoleProfile(
  service: ReturnType<typeof createClient>,
  id: string,
  role: string,
  fullName: string,
) {
  if (role === "publisher") await ensurePublisher(service, id, fullName);
  if (role === "service_provider") await ensureProvider(service, id, fullName);
}

async function assertAdminRole(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  role: string,
  adminRoleId: unknown,
) {
  if (!canAssignUserRole(actor.role, role)) {
    throw new Failure(403, "منح صلاحيات إدارية متاح لمدير النظام فقط.");
  }
  if (role !== "general_supervisor" || adminRoleId == null || adminRoleId === "") return;
  if (typeof adminRoleId !== "string" || !uuidPattern.test(adminRoleId)) {
    throw new Failure(400, "مجموعة الصلاحيات المختارة غير صالحة.");
  }
  const { data, error } = await service.from("admin_roles")
    .select("id").eq("id", adminRoleId).maybeSingle();
  if (error) throw new Failure(503, "تعذر التحقق من مجموعة الصلاحيات.");
  if (!data) throw new Failure(400, "مجموعة الصلاحيات المختارة غير موجودة.");
}

async function verifyActor(request: Request) {
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new Failure(401, "انتهت الجلسة. سجّل الدخول مجددًا.");
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) throw new Failure(503, "خدمة إدارة المستخدمين غير مهيأة.");

  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) throw new Failure(401, "انتهت الجلسة. سجّل الدخول مجددًا.");

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error } = await service.from("user_profiles")
    .select("id, full_name, role, archived_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error) throw new Failure(503, "تعذر التحقق من صلاحيات الحساب.");
  if (!profile || !isActiveUsersAdmin(profile.role, profile.archived_at)) {
    throw new Failure(403, "إدارة المستخدمين متاحة للإداريين فقط.");
  }
  return {
    service,
    actor: { id: profile.id, name: profile.full_name ?? "", role: profile.role } as Actor,
  };
}

async function userById(service: ReturnType<typeof createClient>, id: string) {
  if (!uuidPattern.test(id)) throw new Failure(400, "معرّف الحساب غير صالح.");
  const [
    { data: profile, error: profileError },
    { data: authData, error: authError },
    { data: guardianLink, error: guardianError },
  ] = await Promise.all([
    service.from("user_profiles")
      .select("id, full_name, role, is_guardian, admin_role_id, created_at, suspended_at, suspension_reason, archived_at, archived_by")
      .eq("id", id).maybeSingle(),
    service.auth.admin.getUserById(id),
    service.from("child_profiles").select("id")
      .eq("user_profile_id", id).limit(1),
  ]);
  if (profileError) throw new Failure(503, "تعذر تحميل بيانات الحساب.");
  if (guardianError) throw new Failure(503, "تعذر التحقق من حسابات الأبناء.");
  if (!profile) throw new Failure(404, "الحساب غير موجود.");
  if (authError && authError.status !== 404) throw new Failure(503, "تعذر تحميل بيانات تسجيل الدخول.");
  const authUser = authData.user;
  const { data: child, error: childError } = await service.from("child_profiles")
    .select("id")
    .eq("account_profile_id", id)
    .limit(1);
  if (childError) throw new Failure(503, "تعذر التحقق من ارتباط الحساب بالعائلة.");
  const now = Date.now();
  const bannedUntil = authUser?.banned_until ?? null;
  const banned = !authUser || Boolean(bannedUntil && new Date(bannedUntil).getTime() > now);
  const status = profile.archived_at
    ? "archived"
    : banned
      ? "fully_suspended"
      : profile.suspended_at
        ? "purchase_stopped"
        : "active";
  return {
    ...profile,
    email: authUser?.email ?? "",
    is_guardian: Boolean(guardianLink?.length),
    banned_until: bannedUntil,
    is_child_account: Boolean(child?.length),
    status,
  };
}

async function requestBody(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 20_000) throw new Failure(413, "الطلب كبير جدًا.");
  try {
    const body: unknown = JSON.parse(raw);
    if (!safeJson(body)) throw new Failure(400, "صيغة الطلب غير صحيحة.");
    return body;
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(400, "صيغة الطلب غير صحيحة.");
  }
}

async function createUser(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  values: JsonObject,
) {
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const fullName = typeof values.fullName === "string" ? values.fullName.trim() : "";
  const role = typeof values.role === "string" ? values.role : "";
  if (values.creationMethod !== "invite" && values.creationMethod !== "password") {
    throw new Failure(400, "اختر طريقة إنشاء الحساب.");
  }
  const method = values.creationMethod;
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Failure(400, "اكتب بريدًا إلكترونيًا صحيحًا.");
  if (fullName.length < 2 || fullName.length > 120) throw new Failure(400, "اكتب الاسم كاملًا.");
  if (!roles.includes(role)) throw new Failure(400, "الدور المختار غير صالح.");
  const adminRoleId = values.adminRoleId == null || values.adminRoleId === "" ? null : values.adminRoleId;
  await assertAdminRole(service, actor, role, adminRoleId);

  const typedPassword = typeof values.password === "string" ? values.password.trim() : "";
  if (typedPassword && (typedPassword.length < 8 || typedPassword.length > 128)) {
    throw new Failure(400, "كلمة المرور يجب أن تكون بين ٨ و١٢٨ حرفًا.");
  }
  const generatedPassword = method === "password" && !typedPassword ? temporaryPassword() : null;
  const password = method === "password" ? typedPassword || generatedPassword! : undefined;
  let userId = "";
  let inviteLink: string | undefined;

  if (method === "invite") {
    const { data, error } = await service.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName } },
    });
    if (error || !data.user?.id || !data.properties?.hashed_token) {
      if (error?.message.toLowerCase().includes("already")) throw new Failure(409, "يوجد حساب مسجل بهذا البريد بالفعل.");
      throw new Failure(502, "تعذر إنشاء رابط الدعوة.");
    }
    userId = data.user.id;
    const { error: flagError } = await service.auth.admin.updateUserById(userId, {
      app_metadata: { must_set_password: true },
    });
    if (flagError) {
      await service.auth.admin.deleteUser(userId);
      throw new Failure(502, "تعذر تجهيز الحساب للدعوة.");
    }
    const appUrl = (env("CLIENT_APP_URL") || "https://www.alrehla.org").replace(/\/+$/, "");
    inviteLink = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  } else {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { must_set_password: true },
    });
    if (error || !data.user?.id) {
      if (error?.message.toLowerCase().includes("already")) throw new Failure(409, "يوجد حساب مسجل بهذا البريد بالفعل.");
      throw new Failure(502, "تعذر إنشاء الحساب.");
    }
    userId = data.user.id;
  }

  const { error: profileError } = await service.from("user_profiles").upsert({
    id: userId,
    full_name: fullName,
    role,
    admin_role_id: role === "general_supervisor" ? adminRoleId : null,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    await service.auth.admin.deleteUser(userId);
    throw new Failure(503, "تعذر حفظ ملف الحساب. لم يكتمل الإنشاء.");
  }
  try {
    await ensureRoleProfile(service, userId, role, fullName);
  } catch (error) {
    await service.from("user_profiles").delete().eq("id", userId);
    await service.auth.admin.deleteUser(userId);
    throw error;
  }

  await insertAudit(service, actor, method === "invite" ? "user_invited" : "user_created", userId, {
    email,
    role,
  });
  return {
    data: {
      ...await userById(service, userId),
      ...(inviteLink ? { invite_link: inviteLink } : {}),
      ...(password ? { one_time_password: password } : {}),
    },
  };
}

async function updateUser(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  id: string,
  values: JsonObject,
) {
  if (!uuidPattern.test(id)) throw new Failure(400, "معرّف الحساب غير صالح.");
  const current = await userById(service, id);
  if (current.archived_at) throw new Failure(409, "لا يمكن تعديل حساب مؤرشف.");
  const fullName = typeof values.fullName === "string" ? values.fullName.trim() : "";
  const role = typeof values.role === "string" ? values.role : "";
  if (fullName.length < 2 || fullName.length > 120) throw new Failure(400, "اكتب الاسم كاملًا.");
  const unchangedSpecialRole = role === current.role && ["visitor", "student", "instructor"].includes(role);
  if (!roles.includes(role) && !unchangedSpecialRole) throw new Failure(400, "الدور المختار غير صالح.");
  if (current.is_child_account && role !== current.role) {
    throw new Failure(409, "حساب الطفل تابع لولي أمره ولا يتغير دوره من هذه الصفحة.");
  }
  if (!canChangeUserRole(actor.role, current.role, role)) {
    throw new Failure(403, "تعديل الأدوار الإدارية متاح لمدير النظام فقط.");
  }
  const adminRoleId = values.adminRoleId == null || values.adminRoleId === "" ? null : values.adminRoleId;
  await assertAdminRole(service, actor, role, adminRoleId);

  const { error } = await service.rpc("admin_update_user_profile", {
    p_actor: actor.id,
    p_user: id,
    p_full_name: fullName,
    p_role: role,
    p_admin_role_id: role === "general_supervisor" ? adminRoleId : null,
  });
  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501") throw new Failure(403, message || "تعديل الأدوار الإدارية متاح لمدير النظام فقط.");
    if (error.code === "P0002") throw new Failure(404, "الحساب غير موجود.");
    if (error.code === "P0001") throw new Failure(409, message || "تعذر حفظ التعديلات.");
    if (error.code === "22023") throw new Failure(400, message || "البيانات المختارة غير صالحة.");
    throw new Failure(503, "تعذر حفظ التعديلات.");
  }
  try {
    await ensureRoleProfile(service, id, role, fullName);
  } catch (failure) {
    const { error: rollbackError } = await service.rpc("admin_update_user_profile", {
      p_actor: actor.id,
      p_user: id,
      p_full_name: current.full_name,
      p_role: current.role,
      p_admin_role_id: current.admin_role_id,
    });
    if (rollbackError) {
      throw new Failure(503, "تم حفظ التعديل، لكن تعذر تجهيز ملف الدور أو استرجاع القيم السابقة. راجع الحساب قبل المتابعة.");
    }
    throw failure;
  }
  await insertAudit(service, actor, "user_profile_updated", id, {
    role_before: current.role,
    role_after: role,
  });
  return { data: await userById(service, id) };
}

async function setSuspension(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  body: JsonObject,
) {
  const id = typeof body.userId === "string" ? body.userId : "";
  const suspend = body.suspend === true;
  const blockLogin = suspend && body.blockLogin === true;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!uuidPattern.test(id)) throw new Failure(400, "معرّف الحساب غير صالح.");
  if (id === actor.id) throw new Failure(400, "لا يمكنك إيقاف حسابك.");
  if (suspend && reason.length < 3) throw new Failure(400, "اكتب سبب الإيقاف، ثلاثة أحرف على الأقل.");
  const target = await userById(service, id);
  if (target.archived_at) throw new Failure(409, "الحساب مؤرشف بالفعل.");
  if (!canSuspendUserAccount(actor.id, id, target.role, target.archived_at)) {
    throw new Failure(403, id === actor.id ? "لا يمكنك إيقاف حسابك." : "الحسابات الإدارية لا يمكن إيقافها.");
  }

  const now = new Date().toISOString();
  const { data: saved, error } = await service.from("user_profiles").update({
    suspended_at: suspend ? now : null,
    suspension_reason: suspend ? reason : null,
    updated_at: now,
  }).eq("id", id).select("id, suspended_at").maybeSingle();
  if (error || !saved || Boolean(saved.suspended_at) !== suspend) {
    throw new Failure(503, "تعذر تحديث حالة الحساب.");
  }

  const { error: authError } = await service.auth.admin.updateUserById(id, {
    ban_duration: blockLogin ? "876000h" : "none",
  });
  await insertAudit(
    service,
    actor,
    suspend ? blockLogin ? "user_fully_suspended" : "user_purchase_stopped" : "user_suspension_removed",
    id,
    { reason: suspend ? reason : null },
  );
  if (authError) {
    throw new Failure(
      502,
      blockLogin
        ? "تم إيقاف الشراء، لكن منع تسجيل الدخول لم يكتمل. حاول مرة أخرى."
        : suspend
          ? "تم إيقاف الشراء، لكن تعذر تحديث حالة تسجيل الدخول."
          : "تم فك إيقاف الشراء، لكن تعذر فك حظر تسجيل الدخول. حاول مرة أخرى.",
    );
  }
  return { data: await userById(service, id) };
}

function authDeleteSucceededOrMissing(error: { status?: number; message?: string } | null) {
  return !error || error.status === 404 || /not.?found/i.test(error.message ?? "");
}

async function deleteUser(
  service: ReturnType<typeof createClient>,
  actor: Actor,
  body: JsonObject,
) {
  if (actor.role !== "super_admin") throw new Failure(403, "حذف الحسابات متاح لمدير النظام فقط.");
  const id = typeof body.userId === "string" ? body.userId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!uuidPattern.test(id)) throw new Failure(400, "معرّف الحساب غير صالح.");
  if (id === actor.id) throw new Failure(400, "لا يمكنك حذف حسابك.");
  if (reason.length < 3) throw new Failure(400, "اكتب سبب الحذف، ثلاثة أحرف على الأقل.");
  const target = await userById(service, id);
  if (target.archived_at) throw new Failure(409, "الحساب مؤرشف بالفعل.");
  if (target.is_child_account) throw new Failure(409, "حساب الطفل يُدار من حساب ولي أمره.");
  if (!canDeleteUserAccount({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: id,
    targetRole: target.role,
    isChildAccount: target.is_child_account,
    archivedAt: target.archived_at,
  })) {
    throw new Failure(403, "الحسابات الإدارية أو حسابك لا يمكن حذفها.");
  }

  const { data: activity, error: activityError } = await service.rpc("account_activity", { p_user: id });
  if (activityError || !safeJson(activity)) throw new Failure(503, "تعذر فحص حركات الحساب. لم يتم الحذف.");
  const total = Number(activity.total ?? 0);
  const { data: children, error: childError } = await service.from("child_profiles")
    .select("account_profile_id")
    .eq("user_profile_id", id)
    .not("account_profile_id", "is", null);
  if (childError) throw new Failure(503, "تعذر تحميل حسابات دخول الأبناء. لم يتم الحذف.");
  const loginIds = [...new Set([
    id,
    ...(children ?? []).map((row) => row.account_profile_id)
      .filter((value): value is string => typeof value === "string"),
  ])];

  for (const loginId of loginIds) {
    const { error } = await service.auth.admin.updateUserById(loginId, { ban_duration: "876000h" });
    if (!authDeleteSucceededOrMissing(error)) {
      await insertAudit(service, actor, "user_delete_partial_lock_failure", id, { reason, failed_account_id: loginId });
      throw new Failure(502, "تعذر قفل أحد الحسابات. لم يكتمل الحذف؛ راجع حالة الدخول قبل المحاولة مجددًا.");
    }
  }

  let mode: "deleted" | "archived";
  if (total === 0) {
    const { data: purged, error } = await service.rpc("admin_delete_user", {
      p_actor: actor.id,
      p_user: id,
      p_reason: reason,
    });
    if (error) {
      if (error.code === "42501") throw new Failure(403, error.message || "حذف الحسابات متاح لمدير النظام فقط.");
      throw new Failure(409, "تغيرت حركات الحساب أو تعذر الحذف. حدّث البيانات قبل المحاولة.");
    }
    mode = "deleted";
    for (const loginId of Array.isArray(purged) ? purged : loginIds) {
      if (typeof loginId !== "string") continue;
      const { error: deleteError } = await service.auth.admin.deleteUser(loginId);
      if (!authDeleteSucceededOrMissing(deleteError)) {
        await insertAudit(service, actor, "user_deleted_auth_cleanup_failed", id, { reason, mode });
        throw new Failure(502, "حُذفت بيانات الحساب وأُغلق الدخول، لكن تعذر حذف أحد حسابات تسجيل الدخول.");
      }
    }
  } else {
    const { error } = await service.rpc("admin_archive_user", {
      p_actor: actor.id,
      p_user: id,
      p_reason: reason,
    });
    if (error) {
      if (error.code === "42501") throw new Failure(403, error.message || "أرشفة الحسابات متاحة لمدير النظام فقط.");
      throw new Failure(409, "قُفل الدخول، لكن تعذر تأكيد الأرشفة والحركات. حدّث البيانات قبل المحاولة.");
    }
    mode = "archived";
  }

  await insertAudit(service, actor, mode === "deleted" ? "user_account_deleted" : "user_account_archived", id, {
    name: target.full_name,
    reason,
    activity,
  });
  return { data: { id, mode } };
}

export async function handleRequest(request: Request): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  const json = (status: number, value: unknown) => Response.json(value, { status, headers: cors });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { service, actor } = await verifyActor(request);
    const body = await requestBody(request);
    switch (body.action) {
      case "list": {
        const { data, error } = await service.rpc("admin_list_users", {
          p_actor: actor.id,
          p_search: typeof body.search === "string" ? body.search.slice(0, 120) : null,
          p_role: typeof body.role === "string" ? body.role : null,
          p_guardian: typeof body.guardian === "boolean" ? body.guardian : null,
          p_status: typeof body.status === "string" ? body.status : "not_archived",
          p_sort: typeof body.sort === "string" ? body.sort : "created_at",
          p_order: body.order === "asc" ? "asc" : "desc",
          p_offset: Number.isSafeInteger(body.offset) ? body.offset as number : 0,
          p_limit: Number.isSafeInteger(body.limit) ? body.limit as number : 20,
        });
        if (error) throw new Failure(error.code === "42501" ? 403 : 503, "تعذر تحميل المستخدمين.");
        return json(200, data);
      }
      case "get": {
        const id = typeof body.id === "string" ? body.id : "";
        return json(200, { data: await userById(service, id) });
      }
      case "activity": {
        const id = typeof body.userId === "string" ? body.userId : "";
        if (!uuidPattern.test(id)) throw new Failure(400, "معرّف الحساب غير صالح.");
        const { data, error } = await service.rpc("account_activity", { p_user: id });
        if (error || !safeJson(data)) throw new Failure(503, "تعذر فحص حركات الحساب.");
        return json(200, { data });
      }
      case "admin_roles": {
        const { data, error } = await service.from("admin_roles")
          .select("id, name, is_default")
          .order("is_default", { ascending: false })
          .order("name");
        if (error) throw new Failure(503, "تعذر تحميل مجموعات الصلاحيات.");
        return json(200, { data: data ?? [] });
      }
      case "create":
        if (!safeJson(body.values)) throw new Failure(400, "بيانات المستخدم غير صالحة.");
        return json(200, await createUser(service, actor, body.values));
      case "update":
        if (!safeJson(body.values) || typeof body.id !== "string") throw new Failure(400, "بيانات التعديل غير صالحة.");
        return json(200, await updateUser(service, actor, body.id, body.values));
      case "suspension":
        return json(200, await setSuspension(service, actor, body));
      case "delete":
        return json(200, await deleteUser(service, actor, body));
      default:
        throw new Failure(400, "العملية المطلوبة غير مدعومة.");
    }
  } catch (error) {
    if (error instanceof Failure) return json(error.status, { error: error.message });
    console.error("admin-users request failed", error instanceof Error ? error.name : "Unknown");
    return json(500, { error: "تعذر إتمام العملية. حاول مرة أخرى." });
  }
}

Deno.serve(handleRequest);
