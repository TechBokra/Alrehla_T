'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditAction } from '@/lib/audit';
import type { UserRole } from '@/types';
import { generateTempCode, MUST_SET_PASSWORD } from '@/lib/first-login';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/seo';

/**
 * عنوان الموقع اللي الإدارة فاتحاه دلوقتي — عشان رابط الدعوة يروح لنفس
 * الموقع، مش لعنوان مكتوب في إعداد ممكن يكون قديم.
 */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return SITE_URL;
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * ليه النتيجة بترجع بدل ما الخطأ يترمي:
 *   Next.js في الإنتاج بيخفي أي رسالة خطأ جاية من الخادم ويستبدلها بنص
 *   إنجليزي عام. يعني رسالة زي «فيه حساب بالبريد ده بالفعل» ما بتوصلش
 *   للإدارة أصلًا. فالرسائل اللي المفروض تتقرا بترجع كنتيجة عادية.
 */
export type UserActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/**
 * الأدوار اللي تتحدد من شاشة المستخدمين.
 *
 * ❗ «مدرب» مش هنا عن قصد: المدرب محتاج ملف مدرب كامل (تخصص، سعر،
 * مواعيد)، ولو اتحدد دوره من هنا بس هيبقى عنده دور من غير ملف — لوحة
 * فاضية وحساب مكسور. المدرب بيتضاف من شاشة «المدربين» وحدها.
 */
const ASSIGNABLE_ROLES: UserRole[] = [
  'student',
  'service_provider',
  'publisher',
  'general_supervisor',
  'super_admin',
];

const ADMIN_ROLES: UserRole[] = ['super_admin', 'general_supervisor'];

function checkRole(role: UserRole, actorRole: UserRole): string | null {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    if (role === 'instructor') {
      return 'دور المدرب بيتحدد من شاشة «المدربين» عشان يتعمل له ملف مدرب كامل.';
    }
    return 'الدور المختار غير صالح';
  }
  // منح صلاحيات إدارية قرار خطير: مدير النظام وحده يقدر يعمله.
  if (ADMIN_ROLES.includes(role) && actorRole !== 'super_admin') {
    return 'منح صلاحيات إدارية متاح لمدير النظام فقط';
  }
  return null;
}

// الرمز المؤقت بقى في `@/lib/first-login` — مشترك مع شاشة المدربين،
// وحروفه الملتبسة مشالة عشان يتقال في تليفون من غير لبس.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * الدور الإداري («محاسب»، «مسؤول محتوى»…) — schema/05.
 *
 * بيتكتب للإداري (`general_supervisor`) بس؛ أي دور تاني القاعدة بتصفّره.
 * `null` = الدور الافتراضي. وأي قيمة مش رقم صالح بتترفض بدل ما تتجاهل
 * — الإداري اللي اختار «محاسب» لازم يعرف لو ماتسجّلش.
 */
function cleanAdminRoleId(
  role: UserRole,
  adminRoleId: string | null | undefined,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (role !== 'general_supervisor' || adminRoleId === undefined) {
    return { ok: true, value: undefined };
  }
  if (adminRoleId === null || adminRoleId === '') return { ok: true, value: null };
  if (!UUID.test(adminRoleId)) return { ok: false, error: 'الدور الإداري المختار غير صالح' };
  return { ok: true, value: adminRoleId };
}

/** كتابة الملف الشخصي بعد إنشاء الحساب — مشتركة بين الطريقتين. */
async function writeProfile(
  userId: string,
  fullName: string,
  role: UserRole,
  adminRoleId?: string | null,
) {
  const supabaseAdmin = createAdminClient();
  // الملف الشخصي قد يكون أُنشئ بمحفّز عند التسجيل — upsert بتتعامل مع
  // الحالتين من غير ما تكسر لو الصف موجود.
  return supabaseAdmin.from('user_profiles').upsert(
    {
      id: userId,
      full_name: fullName,
      role,
      ...(adminRoleId !== undefined ? { admin_role_id: adminRoleId } : {}),
    },
    { onConflict: 'id' },
  );
}

/**
 * إنشاء حساب مباشرة بكلمة مرور — من غير دعوة.
 *
 * الحساب بيتعمل مفعّل وجاهز للدخول فورًا. الرمز بيرجع للإدارة مرة
 * واحدة عشان تسلّمه لصاحبه؛ إحنا ما بنخزّنهوش في أي مكان عندنا
 * (Supabase بتخزّن بصمته المشفّرة بس).
 *
 * ⚠️ **والرمز ده مؤقت بالبناء لا بالنية:** الحساب بيتعلّم إنه محتاج
 *    كلمة مرور، فأول ما صاحبه يدخل بيتوقف على شاشة «حط كلمة مرورك»
 *    وما يقدرش يعدّيها. يعني الإدارة ما بتعرفش كلمة المرور الدائمة
 *    أبدًا — وده نفس الضمان بتاع رابط الدعوة، بخطوة أبسط.
 */
export async function createUserDirectly(params: {
  email: string;
  fullName: string;
  role: UserRole;
  /** الدور الإداري لو الدور «إداري» — `null` = الافتراضي. */
  adminRoleId?: string | null;
  password?: string;
}): Promise<UserActionResult<{ userId: string; password: string }>> {
  const admin = await requireAdmin('canManageUsers', 'غير مصرح لك بإضافة مستخدمين');

  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const typed = params.password?.trim() ?? '';

  if (!email || !email.includes('@')) return { ok: false, error: 'اكتب بريدًا إلكترونيًا صحيحًا' };
  if (!fullName) return { ok: false, error: 'اكتب اسم الشخص' };
  if (typed && typed.length < 8) {
    return { ok: false, error: 'كلمة المرور لازم تكون 8 حروف على الأقل' };
  }

  const roleError = checkRole(params.role, admin.role);
  if (roleError) return { ok: false, error: roleError };
  const adminRole = cleanAdminRoleId(params.role, params.adminRoleId);
  if (!adminRole.ok) return { ok: false, error: adminRole.error };

  const password = typed || generateTempCode();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    // مفعّل فورًا: مفيش بريد تأكيد بيتبعت، ودي فكرة «إنشاء مباشر» أصلًا.
    email_confirm: true,
    user_metadata: { full_name: fullName },
    // ⚠️ **أي حساب الإدارة عارفة كلمة مروره لازم تتغيّر أول دخول.**
    //    ده بيشمل الرمز المولَّد **والكلمة اللي الإداري كتبها بإيده** —
    //    الاتنين مرّوا على طرف تالت، فالاتنين مؤقتين.
    //
    //    والعلامة في `app_metadata` لا `user_metadata`: التانية
    //    المستخدم يعدّلها من المتصفح ويعدّي الشاشة.
    app_metadata: { [MUST_SET_PASSWORD]: true },
  });

  if (error) {
    console.error('Error creating user', error);
    if (error.message?.toLowerCase().includes('already')) {
      return { ok: false, error: 'فيه حساب بالبريد ده بالفعل' };
    }
    return { ok: false, error: `تعذّر إنشاء الحساب: ${error.message}` };
  }

  const userId = data.user?.id;
  if (!userId) return { ok: false, error: 'تعذّر إنشاء الحساب' };

  const { error: profileError } = await writeProfile(
    userId,
    fullName,
    params.role,
    adminRole.value,
  );
  if (profileError) {
    console.error('Error creating profile', profileError);
    return {
      ok: false,
      error: 'الحساب اتعمل لكن تعذّر حفظ بياناته — عدّل الدور من الجدول يدويًا',
    };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'user_created',
    entityType: 'UserProfile',
    entityId: userId,
    metadata: { email, role: params.role },
  });

  revalidatePath('/dashboard/admin/users');
  return { ok: true, userId, password };
}

/**
 * دعوة شخص للانضمام للمنصة.
 *
 * بنولّد **رابط دعوة** ونرجّعه للإدارة عشان تبعته بنفسها (واتساب مثلًا)،
 * بدل ما نعتمد على خدمة بريد. الرابط بيوصّل الشخص لصفحة يحط فيها كلمة
 * مروره بنفسه — فمفيش كلمة مرور بتمر على الإدارة ولا بتتخزّن في أي مكان.
 *
 * ⚠️ الرابط ده مفتاح: أي حد يفتحه يقدر يحدد كلمة المرور. يتبعت للشخص
 * المقصود وحده.
 *
 * ── الرابط على موقعنا، مش رابط Supabase ─────────────────────
 *
 * رابط Supabase الجاهز (`action_link`) كان بيرجّع الشخص على «عنوان
 * الموقع» المتسجّل في Supabase — وفي القاعدة الجديدة ده كان
 * `localhost:3000` — وبيحط الجلسة بعد `#` في العنوان، والجزء ده
 * مابيوصلش للخادم أصلًا. فالرابط مكانش بيشتغل.
 *
 * دلوقتي بناخد **بصمة الرمز** (`hashed_token`) ونبني الرابط بنفسنا على
 * `/auth/confirm` في **نفس الموقع اللي الإدارة فاتحاه** — فمايعتمدش
 * على أي إعداد في Supabase. والتحقق بيحصل هناك بضغطة زرار
 * (`confirmInvite`).
 */
export async function inviteUser(params: {
  email: string;
  fullName: string;
  role: UserRole;
  /** الدور الإداري لو الدور «إداري» — `null` = الافتراضي. */
  adminRoleId?: string | null;
}): Promise<UserActionResult<{ userId: string; inviteLink: string }>> {
  const admin = await requireAdmin('canManageUsers', 'غير مصرح لك بإضافة مستخدمين');

  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();

  if (!email || !email.includes('@')) return { ok: false, error: 'اكتب بريدًا إلكترونيًا صحيحًا' };
  if (!fullName) return { ok: false, error: 'اكتب اسم الشخص' };

  const roleError = checkRole(params.role, admin.role);
  if (roleError) return { ok: false, error: roleError };
  const adminRole = cleanAdminRoleId(params.role, params.adminRoleId);
  if (!adminRole.ok) return { ok: false, error: adminRole.error };

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    console.error('Error generating invite link', error);
    if (error.message?.toLowerCase().includes('already')) {
      return { ok: false, error: 'فيه حساب بالبريد ده بالفعل' };
    }
    return { ok: false, error: `تعذّر إنشاء الدعوة: ${error.message}` };
  }

  const newUserId = data.user?.id;
  const tokenHash = data.properties?.hashed_token;
  if (!newUserId || !tokenHash) return { ok: false, error: 'تعذّر إنشاء الحساب' };

  // ⚠️ **الحساب لسه مالوش كلمة مرور.** العلامة دي هي اللي بتوقفه على
  //    شاشة «حدّد كلمة مرورك» بعد ما يدخل من الرابط — من غيرها كان
  //    هيدخل لوحته ويفضل حساب بلا كلمة مرور، ومايعرفش يدخل تاني.
  const { error: flagError } = await supabaseAdmin.auth.admin.updateUserById(newUserId, {
    app_metadata: { [MUST_SET_PASSWORD]: true },
  });
  if (flagError) {
    console.error('Error flagging invited user', flagError);
    return { ok: false, error: 'اتعمل الحساب لكن تعذّر تجهيز الدعوة — جرّب «إنشاء مباشر» بدلها' };
  }

  const inviteLink = `${await currentOrigin()}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}`;

  const { error: profileError } = await writeProfile(
    newUserId,
    fullName,
    params.role,
    adminRole.value,
  );
  if (profileError) {
    console.error('Error creating profile for invited user', profileError);
    return {
      ok: false,
      error: 'اتعملت الدعوة لكن تعذّر حفظ بيانات المستخدم — راجع الحساب يدويًا',
    };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'user_invited',
    entityType: 'UserProfile',
    entityId: newUserId,
    metadata: { email, role: params.role },
  });

  revalidatePath('/dashboard/admin/users');
  return { ok: true, userId: newUserId, inviteLink };
}

/**
 * تغيير دور مستخدم.
 *
 * عملية جدول عادية — بتمر بصلاحيات قاعدة البيانات، مش بمفتاح الإدارة.
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
  /** الدور الإداري لو الدور «إداري» — `null` = الافتراضي، ومن غيره = زي ما هو. */
  adminRoleId?: string | null,
): Promise<UserActionResult> {
  const admin = await requireAdmin('canManageUsers', 'غير مصرح لك بتعديل أدوار المستخدمين');

  const roleError = checkRole(role, admin.role);
  if (roleError) return { ok: false, error: roleError };
  const adminRole = cleanAdminRoleId(role, adminRoleId);
  if (!adminRole.ok) return { ok: false, error: adminRole.error };

  // حماية من قفل النظام على نفسه: آخر مدير نظام ما يقدرش ينزّل دور نفسه.
  if (userId === admin.id && role !== admin.role && admin.role === 'super_admin') {
    const supabase = await createClient();
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error: 'ما ينفعش تنزّل دورك وإنت آخر مدير نظام — عيّن غيرك الأول',
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      role,
      ...(adminRole.value !== undefined ? { admin_role_id: adminRole.value } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error updating user role', error);
    return { ok: false, error: `تعذّر تغيير الدور: ${error.message}` };
  }

  if (!data) {
    return { ok: false, error: 'المستخدم غير موجود أو تعذّر تحديث دوره' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'user_role_changed',
    entityType: 'UserProfile',
    entityId: userId,
    metadata: { role, adminRoleId: adminRole.value ?? null },
  });

  revalidatePath('/dashboard/admin/users');
  revalidatePath(`/dashboard/admin/users/${userId}`);
  return { ok: true };
}

/**
 * إعادة تعيين أو منح كلمة مرور جديدة للمستخدم من لوحة الإدارة.
 *
 * لمساعدة المستخدمين والعملاء المتعثرين في الدخول أو الذين نسوا كلمة المرور.
 * الإدارة يمكنها توليد رمز مؤقت أو إدخال كلمة مرور مخصصة.
 * يتم تفعيل شاشة MUST_SET_PASSWORD لضمان الخصوصية عند أول دخول.
 */
export async function resetUserPassword(params: {
  userId: string;
  customPassword?: string;
}): Promise<UserActionResult<{ email: string; tempCode: string; isCustom: boolean }>> {
  const admin = await requireAdmin('canManageUsers', 'غير مصرح لك بإدارة حسابات المستخدمين');

  const supabaseAdmin = createAdminClient();

  // ── مين المستهدَف؟ ────────────────────────────────────────
  //
  // ⚠️ **ده كان باب رفع صلاحيات مفتوح.**
  //
  //    `canManageUsers` موجودة عند **المشرف العام** كمان، مش مدير
  //    النظام وحده. فالدالة من غير الفحص ده كانت بتخلّي أي مشرف عام
  //    يعيّن كلمة مرور **لحساب مدير النظام** ويدخل مكانه — والحساب
  //    يتسرق من جوّه بضغطتين، والسجل يقول «مدير النظام عمل كذا»
  //    وهو مش هو.
  //
  //    والقاعدة دي مكتوبة في نفس الملف في `checkRole`: «منح صلاحيات
  //    إدارية قرار خطير: مدير النظام وحده يقدر يعمله». وإعادة تعيين
  //    كلمة مرور إداري **أخطر** من منح الصلاحية نفسها، لأنها بتدّي
  //    الحساب كله لا صلاحية واحدة.
  //
  // ⚠️ والدور بيتقري **من القاعدة** لا من اللي الشاشة بعتته
  //    (قاعدة «ف»).
  const { data: targetProfile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', params.userId)
    .maybeSingle();

  if (profileError) {
    console.error('Error reading target profile before password reset', profileError);
    return { ok: false, error: 'تعذّر قراءة بيانات الحساب — جرّب تاني.' };
  }

  const targetRole = (targetProfile?.role ?? 'customer') as UserRole;

  if (ADMIN_ROLES.includes(targetRole) && admin.role !== 'super_admin') {
    return {
      ok: false,
      error: 'الحساب ده إداري — إعادة تعيين كلمة مروره متاحة لمدير النظام وحده.',
    };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(params.userId);
  if (userError || !userData?.user) {
    return { ok: false, error: 'تعذّر العثور على حساب الدخول لهذا المستخدم' };
  }

  const email = userData.user.email ?? '';
  const typed = params.customPassword?.trim() ?? '';
  if (typed && typed.length < 8) {
    return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل' };
  }

  const password = typed || generateTempCode();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    password,
    app_metadata: { [MUST_SET_PASSWORD]: true },
  });

  if (updateError) {
    console.error('Error resetting user password', updateError);
    return { ok: false, error: `تعذّر تعيين كلمة المرور: ${updateError.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'user_password_reset',
    entityType: 'UserProfile',
    entityId: params.userId,
    metadata: { email, isCustom: Boolean(typed) },
  });

  return {
    ok: true,
    email,
    tempCode: password,
    isCustom: Boolean(typed),
  };
}

/**
 * إيقاف حساب عن الشراء — أو فكّ الإيقاف.
 *
 * ── إيه اللي بيحصل بالظبط ───────────────────────────────────
 *
 * **الموقوف مش بيتمنع من الدخول.** بيفضل شايف جلساته اللي دفع
 * تمنها ومعرض شغل ابنه وطلباته القديمة. اللي بيتمنع **الطلب
 * الجديد** — في المتجر وفي الباقات وفي الخدمات الإبداعية.
 *
 * والسبب إن منع الدخول بيحوّل خلافًا إداريًّا لعقاب بيطول خدمة
 * مدفوعة، وده ضرر على ولي الأمر وعلى المنصة في نفس الوقت.
 *
 * ── ومين بيمنع فعلًا ────────────────────────────────────────
 *
 * ⚠️ **المنع محفّز في القاعدة** (ملف 118) على `orders` و
 *    `course_subscriptions` و`service_orders`. الفحص في الكود
 *    بيدّي رسالة مفهومة قبل ما نوصل للقاعدة — مش بديلًا عنه.
 *
 * ⚠️ **والموقوف مايقدرش يفكّ إيقاف نفسه**: `guard_user_profile_fields`
 *    بيجمّد العمودين. من غير ده كان بيفكّه بنداء واحد من متصفحه،
 *    لأن سياسة «المستخدم يعدّل صفّه» بتسمح بالصف والصلاحيات
 *    مابتحرسش الأعمدة (قاعدة «ب»).
 *
 * ⚠️ **والقاعدة بترفض إيقاف حساب إداري** — مدير النظام واحد،
 *    وإيقافه بالغلط مشكلة مالهاش داعي.
 */
export async function setUserSuspension(params: {
  userId: string;
  suspend: boolean;
  reason?: string;
}): Promise<UserActionResult> {
  let admin;
  try {
    admin = await requireAdmin('canManageUsers', 'غير مصرح لك بإيقاف الحسابات');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإيقاف الحسابات' };
  }

  // ⚠️ الإداري مايوقفش نفسه: الحساب ده بيعمل الإيقاف، ولو وقف نفسه
  //    بالغلط بيبقى محتاج حد تاني يفكّه. والقاعدة بترفضه أصلًا
  //    (الإداريون مستثنون)، بس الرسالة هنا أوضح من خطأ قاعدة.
  if (params.userId === admin.id) {
    return { ok: false, error: 'مينفعش توقف حسابك.' };
  }

  const reason = params.reason?.trim() ?? '';
  // ⚠️ السبب مطلوب عند الإيقاف لا عند فكّه: ده الأثر الوحيد اللي
  //    بيفضل لو حد سأل بعد شهور «ليه الحساب ده كان موقوف؟».
  if (params.suspend && reason.length < 3) {
    return { ok: false, error: 'اكتب سبب الإيقاف — بيتسجّل مع الحساب.' };
  }

  const supabase = await createClient();

  // ⚠️ بـ`select()`: الكتابة على صفر صفوف بتنجح في صمت (قاعدة «و»).
  //    من غيرها الشاشة بتقول «اتوقف» والحساب زيّ ما هو — وأخطر
  //    حالة هنا إن المحفّز يرفض (حساب إداري) والإدارة تفتكر إنه
  //    اتوقف فعلًا.
  const { data: saved, error } = await supabase
    .from('user_profiles')
    .update({
      suspended_at: params.suspend ? new Date().toISOString() : null,
      suspension_reason: params.suspend ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.userId)
    .select('id, suspended_at');

  if (error) {
    console.error('Error setting suspension', error);
    return { ok: false, error: error.message || 'تعذّر تنفيذ الإجراء.' };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الحساب مش موجود، أو القاعدة رفضت الإجراء.' };
  }
  // ⚠️ والفحص على **القيمة** لا على رجوع الصف: المحفّز ممكن يرجّع
  //    القيمة القديمة والصف يرجع عادي — ودي اللي خلّت ٦ طلبات
  //    بإجمالي صفر تعدّي ونحن فاكرين إن الكتابة نجحت.
  const actuallySuspended = Boolean(saved[0].suspended_at);
  if (actuallySuspended !== params.suspend) {
    return { ok: false, error: 'القاعدة رفضت الإجراء — الحسابات الإدارية مش بتتوقف.' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: params.suspend ? 'إيقاف حساب عن الشراء' : 'فكّ إيقاف حساب',
    entityType: 'UserProfile',
    entityId: params.userId,
    metadata: { reason: params.suspend ? reason : null },
  });

  revalidatePath(`/dashboard/admin/users/${params.userId}`);
  revalidatePath('/dashboard/admin/users');
  return { ok: true };
}
