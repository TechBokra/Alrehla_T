'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { logAuditAction } from '@/lib/audit';
import { requireNotDependent } from '@/lib/auth-guard';

/**
 * حساب دخول منفصل للطالب التابع.
 *
 * ── الفكرة ──────────────────────────────────────────────────
 *
 * ولي الأمر يفتح لابنه حسابًا باسم وكلمة سر، الطفل يدخل بيه يشوف
 * جلساته ومواده ويكتب في معرض أعماله. **ومايشوفش أي فلوس ولا يشتري
 * ولا يعدّل بياناته الأساسية** — دوره `student` وبس.
 *
 * وولي الأمر يتابع من حسابه هو، ومايدخلش بحساب الطفل أبدًا. عشان كده
 * كلمة السر بتتعرض **مرة واحدة وقت الإنشاء** وخلاص: تخزينها عشان
 * يشوفها بعدين معناها إننا بنحتفظ بكلمة سر قابلة للقراءة، وده غلط.
 * نسيها؟ يعمل إعادة تعيين ويطلع واحدة جديدة.
 *
 * ── ليه بريد مولَّد ─────────────────────────────────────────
 *
 * Supabase Auth بيحتاج بريدًا لكل حساب، والطفل دون 12 غالبًا مالوش.
 * فبنولّد اسم دخول قصير على نطاق داخلي:
 *
 *     t7k3m9@students.alrehla
 *
 * **نتيجة مباشرة لازم تبقى واضحة:** البريد ده مايستقبلش رسائل، يعني
 * **مفيش «نسيت كلمة السر»** للطفل. ولي الأمر هو اللي بيعيد التعيين من
 * المركز العائلي. ده مقصود: الطفل مالوش بريد يستقبل عليه أصلًا.
 *
 * ── التحقق ──────────────────────────────────────────────────
 *
 * كل دالة هنا بتتأكد إن `child_profiles.user_profile_id` = الداخل
 * دلوقتي — يعني ولي الأمر ده فعلًا وليّ الطفل ده. من غير الفحص ده أي
 * حساب يبعت رقم طفل مش بتاعه ويفتحله حساب.
 */

export type StudentAccountResult =
  | { ok: true; loginId: string; password: string }
  | { ok: false; error: string };

/** أقصى سن مسموح لفتح حساب تابع. */
const MAX_DEPENDENT_AGE = 12;

/** حروف وأرقام بلا المتشابهات (0/O و1/l/I) — الطفل بيقراها ويكتبها بإيده. */
const SAFE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomToken(length: number): string {
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += SAFE_CHARS[b % SAFE_CHARS.length];
  return out;
}

/** نطاق داخلي — مايستقبلش بريد، وده مقصود. */
const STUDENT_DOMAIN = 'students.alrehla';

function generateLoginId(): string {
  return `${randomToken(6)}@${STUDENT_DOMAIN}`;
}

/** كلمة سر سهلة النطق للطفل وصعبة التخمين. */
function generatePassword(): string {
  return `${randomToken(4)}-${randomToken(4)}`;
}

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

/**
 * الطفل ده تابع للداخل دلوقتي؟
 *
 * ⚠️ `requireNotDependent` مش `requireUser`.
 *
 *    كانت `requireUser()` — بتتأكد إن في مستخدم داخل وبس. والفرق
 *    مش شكلي: **حساب الطالب نفسه كان يقدر يفتح حسابات طلاب**، لو
 *    قدر يعمل صف طفل تحت حسابه الأول (شوف `family.ts`).
 *
 *    ودي نقطة الاختناق للأربع دوال كلها — فتح الحساب، وكلمة السر
 *    الجديدة، والإيقاف، والتفعيل. سطر واحد بيقفلهم.
 */
async function requireOwnChild(childId: string) {
  // الحارس بيرمي — بنمسكه ونرجّع رسالته نتيجة (قاعدة «هـ»).
  let guardian;
  try {
    guardian = await requireNotDependent('إدارة حسابات الأبناء');
  } catch (err) {
    return { ok: false as const, error: err instanceof Error && err.message ? err.message : 'غير مصرح' };
  }
  const supabase = await createClient();

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, full_name, birth_date, account_profile_id')
    .eq('id', childId)
    .eq('user_profile_id', guardian.id)
    .maybeSingle();

  if (!child) return { ok: false as const, error: 'فرد العائلة ده مش على حسابك' };
  return { ok: true as const, guardian, child, supabase };
}

/**
 * فتح حساب للطفل.
 *
 * السن أقل من 12 شرط — زي ما اتفقنا. ولو تاريخ الميلاد ناقص، بنرفض
 * بدل ما نفترض: تاريخ الميلاد موجود في شاشة إضافة فرد العائلة أصلًا.
 */
export async function createStudentAccount(childId: string): Promise<StudentAccountResult> {
  if (!isAdminApiConfigured()) {
    return {
      ok: false,
      error: 'فتح الحسابات مش مفعّل على الخادم حاليًا. كلّم الإدارة.',
    };
  }

  const ctx = await requireOwnChild(childId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, child, supabase } = ctx;

  if (child.account_profile_id) {
    return { ok: false, error: 'فيه حساب مفتوح بالفعل للفرد ده' };
  }

  const age = ageFrom(child.birth_date);
  if (age === null) {
    return { ok: false, error: 'ضيف تاريخ ميلاد الفرد الأول — السن شرط لفتح الحساب' };
  }
  if (age >= MAX_DEPENDENT_AGE) {
    return {
      ok: false,
      error: `الحساب التابع لمن هم دون ${MAX_DEPENDENT_AGE} سنة. الفرد ده ${age} سنة، ويقدر يسجّل حسابًا مستقلًا بنفسه.`,
    };
  }

  const loginId = generateLoginId();
  const password = generatePassword();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: loginId,
    password,
    // مفعّل فورًا: البريد داخلي ومايستقبلش رسالة تأكيد أصلًا.
    email_confirm: true,
    user_metadata: { full_name: child.full_name, is_dependent: true },
  });

  if (error || !data.user) {
    console.error('Error creating student account', error);
    return { ok: false, error: `تعذّر فتح الحساب: ${error?.message ?? ''}` };
  }

  const accountId = data.user.id;

  // الدور `student`: مايشتريش ومايشوفش فلوس. ده الحارس الحقيقي، مش
  // إخفاء الأزرار في الواجهة.
  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert({ id: accountId, full_name: child.full_name, role: 'student' }, { onConflict: 'id' });

  if (profileError) {
    console.error('Error writing student profile', profileError);
    // الحساب اتعمل في Auth بس ملفه ناقص — بنشيله بدل ما نسيب حساب
    // معلّق بلا دور.
    await admin.auth.admin.deleteUser(accountId);
    return { ok: false, error: 'تعذّر تجهيز الحساب. حاول تاني.' };
  }

  const { data: linked, error: linkError } = await supabase
    .from('child_profiles')
    .update({ account_profile_id: accountId })
    .eq('id', childId)
    .select('id');

  if (linkError || !linked || linked.length === 0) {
    console.error('Error linking student account', linkError);
    await admin.auth.admin.deleteUser(accountId);
    return { ok: false, error: 'تعذّر ربط الحساب بفرد العائلة. حاول تاني.' };
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'student_account_created',
    entityType: 'ChildProfile',
    entityId: childId,
    metadata: { loginId },
  });

  revalidatePath('/account/family');
  return { ok: true, loginId, password };
}

/**
 * كلمة سر جديدة.
 *
 * الطريق الوحيد لما الطفل ينسى: مفيش بريد يستقبل رابط استعادة.
 */
export async function resetStudentPassword(childId: string): Promise<StudentAccountResult> {
  if (!isAdminApiConfigured()) {
    return { ok: false, error: 'الخدمة دي مش مفعّلة على الخادم حاليًا.' };
  }

  const ctx = await requireOwnChild(childId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, child } = ctx;

  if (!child.account_profile_id) {
    return { ok: false, error: 'الفرد ده مالوش حساب' };
  }

  const password = generatePassword();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.updateUserById(child.account_profile_id, {
    password,
  });

  if (error || !data.user) {
    console.error('Error resetting student password', error);
    return { ok: false, error: `تعذّر تغيير كلمة السر: ${error?.message ?? ''}` };
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'student_password_reset',
    entityType: 'ChildProfile',
    entityId: childId,
  });

  revalidatePath('/account/family');
  return { ok: true, loginId: data.user.email ?? '', password };
}

/**
 * إقفال الحساب.
 *
 * **بنحظر الدخول ومابنمسحش**: نصوص الطفل في معرض أعماله وتقارير مدربه
 * مربوطة بالحساب ده. مسحه بيضيّعها — وقاعدة المشروع أصلًا «الإيقاف بدل
 * الحذف».
 */
export async function disableStudentAccount(
  childId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAdminApiConfigured()) {
    return { ok: false, error: 'الخدمة دي مش مفعّلة على الخادم حاليًا.' };
  }

  const ctx = await requireOwnChild(childId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, child } = ctx;

  if (!child.account_profile_id) {
    return { ok: false, error: 'الفرد ده مالوش حساب' };
  }

  const admin = createAdminClient();
  // مدة الحظر طويلة عن قصد: «إقفال» لحد ما ولي الأمر يفتحه تاني.
  const { error } = await admin.auth.admin.updateUserById(child.account_profile_id, {
    ban_duration: '876000h',
  });

  if (error) {
    console.error('Error disabling student account', error);
    return { ok: false, error: `تعذّر إقفال الحساب: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'student_account_disabled',
    entityType: 'ChildProfile',
    entityId: childId,
  });

  revalidatePath('/account/family');
  return { ok: true };
}

/** فتح الحساب تاني بعد إقفاله. */
export async function enableStudentAccount(
  childId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAdminApiConfigured()) {
    return { ok: false, error: 'الخدمة دي مش مفعّلة على الخادم حاليًا.' };
  }

  const ctx = await requireOwnChild(childId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, child } = ctx;

  if (!child.account_profile_id) {
    return { ok: false, error: 'الفرد ده مالوش حساب' };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(child.account_profile_id, {
    ban_duration: 'none',
  });

  if (error) {
    console.error('Error enabling student account', error);
    return { ok: false, error: `تعذّر فتح الحساب: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'student_account_enabled',
    entityType: 'ChildProfile',
    entityId: childId,
  });

  revalidatePath('/account/family');
  return { ok: true };
}
