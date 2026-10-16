'use server';
import { requireSuperAdmin as requireSuperAdminGuard, requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getMyInstructorId } from '@/data/domains/(admin)/instructors/identity';
import { getMyPublisher } from '@/data/domains/(admin)/publishers/queries';
import { getMyProvider } from '@/data/domains/(admin)/providers/queries';

/**
 * Money operations: marking a payout as paid, an instructor's withdrawal
 * request, and the publisher pricing formula.
 *
 * Every action here used to change an in-memory object and return success, so
 * "تم الدفع" was never recorded anywhere and a withdrawal request reached
 * nobody. They now write to the database, and row-level security is the real
 * guard behind the checks made here.
 */

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard`. */
async function requireSuperAdmin() {
  return requireSuperAdminGuard('غير مصرح لك بإدارة المدفوعات');
}

const PAYOUTS_DENIED = 'غير مصرح لك بإدارة المدفوعات';

/**
 * نفس الحارس بس بيرجّع `null` بدل ما يرمي (قاعدة «هـ») — لدوال
 * «تم الدفع» اللي بقت بترجّع نتيجة. ⚠️ كل دالة بتستعمله لازم تتأكد
 * من `null` وترجع فورًا.
 */
async function guardSuperAdmin() {
  try {
    return await requireSuperAdmin();
  } catch {
    return null;
  }
}

/**
 * ⚠️ «تم الدفع» بترجّع ولا بترمي — Next بيمسح نصّ الاستثناء في
 *    الإنتاج، فـ«سجل الدفعة غير موجود» كانت بتوصل «خطأ غير متوقع».
 */
export type PayoutResult = { ok: true } | { ok: false; error: string };

export async function markInstructorPayoutAsPaid(payoutId: string): Promise<PayoutResult> {
  const user = await guardSuperAdmin();
  if (!user) return { ok: false, error: PAYOUTS_DENIED };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payouts')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('owner_kind', 'instructor')
    .select('id, owner_id, amount, status')
    .maybeSingle();

  if (error) {
    console.error('Error marking instructor payout as paid', error);
    return { ok: false, error: 'تعذّر تسجيل الدفع' };
  }

  if (!data) {
    return { ok: false, error: 'سجل الدفعة غير موجود أو تعذّر تحديثه' };
  }

  await logAuditAction({
    actorName: user.fullName,
    actorProfileId: user.id,
    action: 'instructor_payout_marked_paid',
    entityType: 'instructor_payout',
    entityId: payoutId,
    metadata: { instructorId: data.owner_id, amount: data.amount },
  });

  revalidatePath('/dashboard/admin/finance/instructor-payouts');
  revalidatePath(`/dashboard/admin/finance/instructor-payouts/${payoutId}`);
  revalidatePath('/dashboard/instructor/payouts');
  return { ok: true };
}

export async function markPublisherPayoutAsPaid(payoutId: string): Promise<PayoutResult> {
  const user = await guardSuperAdmin();
  if (!user) return { ok: false, error: PAYOUTS_DENIED };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payouts')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('owner_kind', 'publisher')
    .select('id, owner_id, amount, status')
    .maybeSingle();

  if (error) {
    console.error('Error marking publisher payout as paid', error);
    return { ok: false, error: 'تعذّر تسجيل الدفع' };
  }

  if (!data) {
    return { ok: false, error: 'سجل الدفعة غير موجود أو تعذّر تحديثه' };
  }

  await logAuditAction({
    actorName: user.fullName,
    actorProfileId: user.id,
    action: 'publisher_payout_marked_paid',
    entityType: 'publisher_payout',
    entityId: payoutId,
    metadata: { publisherId: data.owner_id, amount: data.amount },
  });

  revalidatePath('/dashboard/admin/finance/publisher-payouts');
  revalidatePath(`/dashboard/admin/finance/publisher-payouts/${payoutId}`);
  return { ok: true };
}

/**
 * المدرب بيطلب سحب مستحقاته.
 *
 * ── ثلاث مشاكل كانت هنا ─────────────────────────────────────
 *
 * **١. المبلغ كان جاي من المتصفح.** الشاشة بتحسب الرصيد وبتبعته،
 * والخادم بياخده زي ما هو ويكتبه. يعني تبويبة متلاعب فيها تقدر تطلب
 * **أي رقم**، والحارس الوحيد إن إداري يبص على الطلب قبل ما يدفع.
 *
 * ودي مخالفة لقاعدة ماشي عليها المشروع كله: دالة إنشاء الطلب بتجيب
 * السعر من جدول المنتجات، ودالة الحجز بتجيبه من الباقة، ودالة
 * المستحق بتحسبه من صف الطلب. **المتصفح مبيبعتش أرقام فلوس.**
 *
 * دلوقتي المبلغ بيتحسب هنا من `instructor_payouts` — والباراميتر
 * اتشال أصلًا عشان محدش يفتكر إنه لسه بيتبعت.
 *
 * **٢. مفيش منع للتكرار.** المدرب يدوس مرتين فيطلع طلبين بنفس
 * الرصيد، والإدارة تشوف صفّين وتفتكرهم مستحقين.
 *
 * **٣. الرصيد الصفر كان بيعدّي.** مدرب لسه مالوش مستحقات يقدر
 * يبعت طلب سحب بصفر.
 *
 * ✅ **وبقى في حارس قاعدة كمان** (ملف 100): محفّز
 *    `guard_withdrawal_request` بيكتب المبلغ من الرصيد الحقيقي
 *    وبيمنع الطلب التاني — **بيكتبه مش بيفحصه**، فاللي جاي من أي
 *    طريق تاني بيتجاهل تمامًا. الفحص هنا بقى للرسالة المفهومة، لا
 *    للحماية.
 */
export type WithdrawalResult =
  | { ok: true; amount: number }
  | { ok: false; error: string };

export async function submitWithdrawalRequest(
  method: string,
  payoutDetails: string,
): Promise<WithdrawalResult> {
  const user = await getCurrentUser();
  // ⚠️ **`service_provider` كان مرفوضًا هنا** — ومقدّم الخدمة المستقل
  //    دوره ده بالظبط. فالمنصة بتحصّل فلوسه من العميل، ولوحته بتقوله
  //    «مستحقك»، وطلب السحب بيترفض. مكانش عنده رصيد أصلًا يطلبه،
  //    لأن `record_service_order_earning` ماكانتش بتسجّل له.
  const OWNERS = ['instructor', 'publisher', 'service_provider'] as const;
  if (!(OWNERS as readonly string[]).includes(user.role)) {
    return { ok: false, error: 'غير مصرح لك بتقديم طلب سحب' };
  }

  // ⚠️ **بيانات التحويل كانت بتضيع.** خانات «اسم البنك» و«رقم
  //    الحساب» في الشاشة مكانتش مربوطة بأي حالة ومبتتبعتش للخادم —
  //    مكتوب عليها `required` بس، فالمدرب بيملاها والمتصفح يسمحله
  //    والخادم ياخد `method` وحده.
  //
  //    فالإدارة بتشوف «تحويل بنكي» **من غير رقم حساب**: طلب وصل
  //    ومينفعش يتنفّذ، ولازم حد يكلّم المدرب يسأله.
  const details = payoutDetails.trim();
  if (!details) {
    return { ok: false, error: 'اكتب بيانات التحويل — من غيرها الطلب مش هينفّذ.' };
  }
  if (details.length > 600) {
    return { ok: false, error: 'بيانات التحويل طويلة أوي — اختصرها.' };
  }

  const supabase = await createClient();

  // ── مين بيطلب؟ ────────────────────────────────────────────
  //
  // ⚠️ **الرقم من الحساب لا من الفورم.** الشاشة مبتبعتش «أنا فلان»،
  //    الخادم بيسأل مين الداخل ويجيب ملفه بنفسه.
  const ownerKind =
    user.role === 'publisher'
      ? ('publisher' as const)
      : user.role === 'service_provider'
        ? ('provider' as const)
        : ('instructor' as const);

  const ownerId =
    ownerKind === 'publisher'
      ? ((await getMyPublisher())?.id ?? null)
      : ownerKind === 'provider'
        ? ((await getMyProvider())?.id ?? null)
        : await getMyInstructorId();

  if (!ownerId) {
    const which =
      ownerKind === 'publisher'
        ? 'الناشر'
        : ownerKind === 'provider'
          ? 'مقدّم الخدمة'
          : 'المدرب';
    return { ok: false, error: `لم يتم العثور على ملف ${which}` };
  }

  // ── الرصيد: من القاعدة لا من الشاشة ───────────────────────
  //
  // ⚠️ الفرعان مكتوبان صراحةً مش باسم جدول متغيّر: اسم الجدول
  //    المتغيّر بيضيّع فحص الأنواع، وفحص الأنواع هو اللي بيمسك لو
  //    عمود اتسمّى غلط.
  // السجلّ واحد للتلاتة دلوقتي (ملف 20261016160000)، فالفرع اتشال:
  // الجدولان المنفصلان هما السبب اللي خلّى محفّزًا يتكتب لواحد ويتنسى
  // التاني — وهي ثغرة السحب اللي اتصلّحت الصبح.
  const { data: earnings, error: earningsError } = await supabase
    .from('payouts')
    .select('amount')
    .eq('owner_kind', ownerKind)
    .eq('owner_id', ownerId)
    .eq('status', 'pending');

  if (earningsError) {
    console.error('Error reading payouts', earningsError);
    return { ok: false, error: 'تعذّر قراءة رصيدك — جرّب تاني.' };
  }

  const available = (earnings ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);

  if (available <= 0) {
    return { ok: false, error: 'مفيش رصيد قابل للسحب دلوقتي.' };
  }

  // ── طلب معلّق واحد يكفي ───────────────────────────────────
  const ownerColumn =
    ownerKind === 'publisher'
      ? 'publisher_id'
      : ownerKind === 'provider'
        ? 'provider_id'
        : 'instructor_id';

  const { data: openRequests, error: openError } = await supabase
    .from('withdrawal_requests')
    .select('id')
    .eq(ownerColumn, ownerId)
    .eq('status', 'pending')
    .limit(1);

  if (openError) {
    console.error('Error reading open withdrawal requests', openError);
    return { ok: false, error: 'تعذّر التحقق من طلباتك السابقة — جرّب تاني.' };
  }

  if (openRequests && openRequests.length > 0) {
    return {
      ok: false,
      error: 'عندك طلب سحب مستني المراجعة خلاص. استنى الرد عليه الأول.',
    };
  }

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .insert({
      // القيد في القاعدة بيرفض الصف اللي فيه أكتر من واحد أو ولا واحد.
      instructor_id: ownerKind === 'instructor' ? ownerId : null,
      publisher_id: ownerKind === 'publisher' ? ownerId : null,
      provider_id: ownerKind === 'provider' ? ownerId : null,
      // ⚠️ المبلغ ده **بيتكتب تاني** في محفّز القاعدة من الرصيد
      //    الحقيقي (ملف 100). بنبعته عشان القيمة تبقى صح لو المحفّز
      //    اتشال يومًا، مش لأنه هو اللي بيتخزّن.
      amount: available,
      method,
      payout_details: details,
      status: 'pending',
    })
    .select('id, amount')
    .maybeSingle();

  if (error || !data) {
    // ⚠️ نص خطأ القاعدة إنجليزي ومبهم للمدرب، فبيتسجّل ومبيتعرضش.
    console.error('Error submitting withdrawal request', error);
    return { ok: false, error: 'تعذّر إرسال طلب السحب — جرّب تاني، ولو فضلت كلّم الإدارة.' };
  }

  await logAuditAction({
    actorName: user.fullName,
    actorProfileId: user.id,
    action: `${ownerKind}_withdrawal_requested`,
    entityType: 'withdrawal_request',
    entityId: data.id,
    metadata: { ownerId, ownerKind, amount: available, method },
  });

  revalidatePath('/dashboard/instructor/payouts');
  revalidatePath('/dashboard/publisher/payouts');
  revalidatePath('/dashboard/provider/payouts');
  revalidatePath('/dashboard/admin/finance');

  // ⚠️ **المبلغ المرجَّع هو اللي القاعدة كتبته، مش اللي حسبناه.**
  //    المحفّز بيعيد حسابه، ولو اتغيّر بينهم (مستحق اتسجّل في نفس
  //    اللحظة) الشاشة لازم تقول الرقم اللي اتسجّل فعلًا — مش اللي
  //    كان في إيدنا قبل الإدراج.
  return { ok: true, amount: Number(data.amount) || available };
}

/**
 * معادلة تسعير الناشرين.
 *
 * ⚠️ **كانت `update` مجرّدة، ودي قاعدة «و» بالنص.**
 *
 *    `UPDATE` على صف **مش موجود** بينجح ويرجّع صفر صفوف. فلو صفّ
 *    `publisher-default` مكانش اتعمل يوم ما الجدول اتبنى، الإدارة
 *    كانت تكتب النسبة وتدوس «حفظ» وتشوف «تم» — **والقيمة ما
 *    اتخزّنتش**. والقارئ بيرجع ساعتها للافتراضي: معامل 1 ورسم 0،
 *    يعني **المنصة ما بتاخدش حاجة** من كل كتاب.
 *
 *    وشاشة المدربين كانت بتعمل `upsert` من الأول — يعني الفرق بين
 *    الشاشتين هو اللي خلّى ده يعدّي. `upsert` هنا بتوحّدهم.
 *
 * ⚠️ **والقيم بتتفحص هنا مش في الواجهة وبس** (قاعدة «ع»): معامل
 *    بالسالب أو رسم بالسالب معناه سعر عميل أقل من نصيب الناشر —
 *    يعني المنصة بتدفع من جيبها على كل عملية بيع.
 */
/**
 * معادلة تسعير **مقدّمي الخدمات** — منفصلة عن معادلة الجلسات.
 *
 * ⚠️ نفس فحوص معادلة الناشرين: معامل بالسالب أو رسم بالسالب معناه
 *    سعر عميل أقل من نصيب المقدّم — يعني المنصة بتدفع من جيبها على
 *    كل خدمة. والفحص هنا لا في الواجهة وبس.
 */
export async function updateProviderPricingSettings(
  multiplier: number,
  fixedFee: number,
): Promise<{ ok: true } | { ok: false; error: string; field?: 'multiplier' | 'fixedFee' }> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح لك بإدارة المدفوعات' };
  }

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return { ok: false, error: 'المعامل لازم يكون رقمًا أكبر من صفر', field: 'multiplier' };
  }
  if (!Number.isFinite(fixedFee) || fixedFee < 0) {
    return { ok: false, error: 'الرسم الثابت لازم يكون صفرًا أو أكتر', field: 'fixedFee' };
  }

  const supabase = await createClient();

  // `upsert` لا `update`: الصف ممكن يكون لسه ماتزرعش، و`UPDATE` على
  // صف مش موجود بينجح ويرجّع صفر صفوف (قاعدة «و»).
  const { data, error } = await supabase
    .from('pricing_formula_settings')
    .upsert(
      {
        id: 'provider-default',
        platform_multiplier: multiplier,
        fixed_admin_fee: fixedFee,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error updating provider pricing settings', error);
    return { ok: false, error: 'تعذّر حفظ إعدادات التسعير' };
  }
  if (!data) {
    return { ok: false, error: 'الحفظ ما وصلش للقاعدة — كلّم الإدارة التقنية' };
  }

  await logAuditAction({
    actorName: user.fullName,
    actorProfileId: user.id,
    action: 'provider_pricing_settings_updated',
    entityType: 'settings',
    entityId: 'provider-default',
    metadata: { multiplier, fixedFee },
  });

  revalidatePath('/dashboard/admin/settings/pricing');
  revalidatePath('/dashboard/admin/services');
  return { ok: true };
}

export async function updatePublisherPricingSettings(
  multiplier: number,
  fixedFee: number,
): Promise<{ ok: true } | { ok: false; error: string; field?: 'multiplier' | 'fixedFee' }> {
  // ⚠️ بترجّع ولا بترمي (قاعدة «هـ») — Next بيمسح نصّ الاستثناء في الإنتاج،
  //    فالإداري كان بيشوف «حدث خطأ» بدل «المعامل لازم يكون أكبر من صفر».
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح لك بإدارة المدفوعات' };
  }

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return { ok: false, error: 'المعامل لازم يكون رقمًا أكبر من صفر', field: 'multiplier' };
  }
  if (!Number.isFinite(fixedFee) || fixedFee < 0) {
    return { ok: false, error: 'الرسم الثابت لازم يكون صفرًا أو أكتر', field: 'fixedFee' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pricing_formula_settings')
    .upsert(
      {
        id: 'publisher-default',
        platform_multiplier: multiplier,
        fixed_admin_fee: fixedFee,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error updating publisher pricing settings', error);
    return { ok: false, error: 'تعذّر حفظ إعدادات التسعير' };
  }

  if (!data) {
    return { ok: false, error: 'الحفظ ما وصلش للقاعدة — كلّم الإدارة التقنية' };
  }

  await logAuditAction({
    actorName: user.fullName,
    actorProfileId: user.id,
    action: 'publisher_pricing_settings_updated',
    entityType: 'settings',
    entityId: 'publisher-default',
    metadata: { multiplier, fixedFee },
  });

  revalidatePath('/dashboard/admin/settings/pricing');
  revalidatePath('/dashboard/admin/products');
  return { ok: true };
}
