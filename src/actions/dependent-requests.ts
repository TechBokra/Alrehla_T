'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getDependentGuardian } from '@/lib/auth-guard';
import { notifyUser } from '@/lib/notifications';
import { logAuditAction } from '@/lib/audit';
import { customizationPath } from '@/lib/product-categories';

/**
 * طلبات الأبناء — «الطفل عايز إيه»، وولي الأمر بيبتّ.
 *
 * ── ليه المسار ده ───────────────────────────────────────────
 *
 * حساب الطفل كان يقدر يشتري ويحجز زي أي عميل، لأن **ولا دالة في
 * المشروع بتفرّق بين `student` و`customer`**. اتقفل الطريق المباشر،
 * والمقصود مش المنع: الطفل يطلب، وولي الأمر يوافق أو يعدّل، وبعدين
 * الدفع.
 *
 * ── الموافقة مابتعملش الطلب ─────────────────────────────────
 *
 * الموافقة بتوصّل ولي الأمر لنفس شاشة الطلب العادية بالبيانات جاهزة،
 * ويكمّل الدفع زي أي عملية. كده مسار الشراء **واحد** — لو الموافقة
 * كانت بتعمل الطلب بنفسها، كان بقى عندنا مسارين للشراء يتفرّعوا
 * ويختلفوا مع الوقت.
 */

export type RequestResult = { ok: true } | { ok: false; error: string; field?: string };

/** رابط الشاشة اللي ولي الأمر بيكمّل منها بعد الموافقة. */
export type ApprovedTarget = { ok: true; href: string } | { ok: false; error: string };

/**
 * الداخل دلوقتي، وهل هو حساب طفل تابع.
 *
 * ⚠️ `requireUser` و`getDependentGuardian` الاتنين بيرموا (مش داخل، أو
 *    فحص نوع الحساب وقع). بنمسكهم ونرجّع الرسالة نتيجة (قاعدة «هـ») —
 *    وفشل الفحص لسه بيوقف العملية زي ما هو، مش بيعدّيها.
 */
async function loadDependent() {
  try {
    const user = await requireUser();
    const dependent = await getDependentGuardian();
    return { ok: true as const, user, dependent };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error && err.message ? err.message : 'غير مصرح' };
  }
}

/**
 * الطفل بيطلب.
 *
 * لازم يكون حساب طفل تابع فعلًا — ولي الأمر عنده أزراره العادية
 * ومش محتاج يمر من هنا.
 */
export async function createDependentRequest(params: {
  kind: 'service' | 'package' | 'product';
  /** قصة أو كتاب (ملف 16 — #ATWG). */
  productId?: string | null;
  serviceId?: string | null;
  providerId?: string | null;
  packageId?: string | null;
  instructorId?: string | null;
  note?: string;
}): Promise<RequestResult> {
  const who = await loadDependent();
  if (!who.ok) return { ok: false, error: who.error };
  const { user, dependent } = who;

  if (!dependent) {
    return { ok: false, error: 'الصفحة دي لحسابات الأبناء. اطلب من حسابك مباشرةً.' };
  }

  if (params.kind === 'service' && !params.serviceId) {
    return { ok: false, error: 'الخدمة مش محددة' };
  }
  if (params.kind === 'package' && !params.packageId) {
    return { ok: false, error: 'الباقة مش محددة' };
  }
  if (params.kind === 'product' && !params.productId) {
    return { ok: false, error: 'القصة مش محددة' };
  }

  const supabase = await createClient();

  // طلب واحد معلّق لنفس الحاجة يكفي — عشان لوحة ولي الأمر ما تتملاش
  // بنفس الطلب عشر مرات.
  const { data: existing } = await supabase
    .from('dependent_requests')
    .select('id')
    .eq('child_profile_id', dependent.childId)
    .eq('status', 'pending')
    .eq(
      params.kind === 'service' ? 'service_id' : params.kind === 'product' ? 'product_id' : 'package_id',
      (params.kind === 'service'
        ? params.serviceId
        : params.kind === 'product'
          ? params.productId
          : params.packageId) as string,
    )
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'بعتّ الطلب ده قبل كده وولي أمرك لسه بيراجعه.' };
  }

  const { data: created, error } = await supabase
    .from('dependent_requests')
    .insert({
      child_profile_id: dependent.childId,
      guardian_profile_id: dependent.guardianId,
      requester_profile_id: user.id,
      kind: params.kind,
      service_id: params.kind === 'service' ? params.serviceId : null,
      provider_id: params.kind === 'service' ? (params.providerId ?? null) : null,
      package_id: params.kind === 'package' ? params.packageId : null,
      instructor_id: params.kind === 'package' ? (params.instructorId ?? null) : null,
      ...(params.kind === 'product' ? { product_id: params.productId } : {}),
      note: params.note?.trim() || null,
      status: 'pending',
    })
    .select('id');

  if (error) {
    console.error('Error creating dependent request', error);
    // قبل ملف 16 نوع «قصة» مش موجود في القاعدة.
    if (params.kind === 'product') return { ok: false, error: 'طلب القصص من حساب الطفل لسه مااتفعّلش — قول لولي أمرك.' };
    return { ok: false, error: `تعذّر إرسال الطلب: ${error.message}` };
  }
  if (!created || created.length === 0) {
    return { ok: false, error: 'الطلب مروّحش للقاعدة — كلّم ولي أمرك.' };
  }

  await notifyUser({
    event: 'service_order_new',
    recipientProfileId: dependent.guardianId,
    title: `طلب جديد من ${dependent.fullName}`,
    message: params.note?.trim()
      ? `«${params.note.trim()}»`
      : 'في طلب مستني مراجعتك في المركز العائلي.',
    link: '/account/family/requests',
  });

  revalidatePath('/account/family/requests');
  return { ok: true };
}

/**
 * الطفل يقترح اسمًا جديدًا لنفسه.
 *
 * ── ليه طلب مش تعديل مباشر ──────────────────────────────────
 *
 * في **اسمين** لنفس الطفل: `user_profiles.full_name` (حساب الطالب)
 * و`child_profiles.full_name` (المركز العائلي). ودوال القاعدة مكتوبة
 * `COALESCE(ch.full_name, up.full_name, …)` — يعني **اسم المركز
 * العائلي بيكسب دايمًا**.
 *
 * فلما الطفل كان بيعدّل اسمه من لوحته، التعديل **بيتحفظ فعلًا** في
 * حسابه — ومبيوصلش لولي الأمر ولا للمدرب ولا للطلبات ولا للكتاب
 * اللي هيتطبع. عملية بتنجح وبتبان ناجحة ومحدّش بيشوف نتيجتها.
 *
 * والاسم ده **بيتطبع على الكتاب**، فمكانش ينفع الطفل يغيّره لوحده.
 * القرار: يقترح، وولي الأمر يوافق أو يرفض بسبب — نفس نمط طلبات
 * الباقات والخدمات.
 */
export async function requestNameChange(newName: string): Promise<RequestResult> {
  const who = await loadDependent();
  if (!who.ok) return { ok: false, error: who.error };
  const { user, dependent } = who;

  if (!dependent) {
    return { ok: false, error: 'الصفحة دي لحسابات الأبناء.' };
  }

  const name = newName.trim();
  if (name.length < 2) return { ok: false, error: 'اكتب اسمك كامل.', field: 'name' };
  if (name.length > 120) return { ok: false, error: 'الاسم طويل أوي.', field: 'name' };
  if (name === dependent.fullName) {
    return { ok: false, error: 'ده اسمك الحالي خلاص.', field: 'name' };
  }

  const supabase = await createClient();

  // طلب تغيير اسم واحد معلّق يكفي.
  const { data: existing } = await supabase
    .from('dependent_requests')
    .select('id')
    .eq('child_profile_id', dependent.childId)
    .eq('kind', 'name_change')
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'بعتّ طلب تغيير اسم قبل كده وولي أمرك لسه بيراجعه.' };
  }

  const { data: created, error } = await supabase
    .from('dependent_requests')
    .insert({
      child_profile_id: dependent.childId,
      guardian_profile_id: dependent.guardianId,
      requester_profile_id: user.id,
      kind: 'name_change',
      requested_name: name,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error creating name change request', error);
    return { ok: false, error: `تعذّر إرسال الطلب: ${error.message}` };
  }
  if (!created) {
    return { ok: false, error: 'الطلب مروّحش للقاعدة — كلّم ولي أمرك.' };
  }

  await notifyUser({
    event: 'service_order_new',
    recipientProfileId: dependent.guardianId,
    title: `${dependent.fullName} عايز يغيّر اسمه`,
    message: `طلب إن اسمه يبقى «${name}».`,
    link: '/account/family/requests',
  });

  revalidatePath('/account/family/requests');
  revalidatePath('/dashboard/student/requests');
  return { ok: true };
}

/**
 * ولي الأمر بيوافق على تغيير الاسم.
 *
 * ⚠️ بتمر على دالة في القاعدة (ملف 93) مش على تعديلين منفصلين: ولي
 *    الأمر يقدر يعدّل `child_profiles` بتاعه، لكنه **ممنوع** من
 *    `user_profiles` بتاع الطفل. ومن غير الاتنين، الطالب هيفضل شايف
 *    اسمه القديم في لوحته بعد الموافقة.
 */
export async function approveNameChange(requestId: string): Promise<RequestResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('apply_dependent_name_change', {
    p_request_id: requestId,
  });

  if (error) {
    console.error('Error approving name change', error);
    return { ok: false, error: error.message || 'تعذّر تطبيق الاسم الجديد.' };
  }

  revalidatePath('/account/family/requests');
  revalidatePath('/account/family');
  revalidatePath('/dashboard/student');
  return { ok: true };
}

/** الطفل يسحب طلبه قبل ما ولي الأمر يبتّ. */
export async function cancelDependentRequest(requestId: string): Promise<RequestResult> {
  const who = await loadDependent();
  if (!who.ok) return { ok: false, error: who.error };
  const { dependent } = who;
  if (!dependent) return { ok: false, error: 'غير مصرح' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dependent_requests')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('child_profile_id', dependent.childId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error cancelling dependent request', error);
    return { ok: false, error: `تعذّر سحب الطلب: ${error.message}` };
  }
  if (!data) {
    return { ok: false, error: 'الطلب مش موجود أو ولي أمرك بتّ فيه خلاص.' };
  }

  revalidatePath('/account/family/requests');
  return { ok: true };
}

/** الطلب ده تخص ولي الأمر الداخل دلوقتي؟ */
async function loadGuardianRequest(requestId: string) {
  let guardian;
  try {
    guardian = await requireUser();
  } catch (err) {
    return { ok: false as const, error: err instanceof Error && err.message ? err.message : 'غير مصرح' };
  }
  const supabase = await createClient();

  const { data } = await supabase
    .from('dependent_requests')
    .select('*, child_profiles(full_name, account_profile_id)')
    .eq('id', requestId)
    .eq('guardian_profile_id', guardian.id)
    .maybeSingle();

  if (!data) return { ok: false as const, error: 'الطلب ده مش على حسابك' };
  return { ok: true as const, guardian, request: data, supabase };
}

/**
 * ولي الأمر بيوافق.
 *
 * مابيعملش الطلب — بيقفل طلب الابن ويرجّع رابط **أول** المسار العادي
 * باختيارات الابن جاهزة، عشان ولي الأمر يكمّل من نفس المسار اللي أي
 * عميل بيمر منه.
 *
 * ── ليه أول المسار مش شاشة الدفع ────────────────────────────
 *
 * ⚠️ الموافقة كانت بتوديه على `booking/confirm` **مباشرةً** — يعني
 *    شاشة الدفع. والمشكلة مش إنها اختصار، المشكلة إن خطوات المسار
 *    بتتخطّى **بقيَم مفترضة من الموقع**:
 *
 *      • **الميعاد الأسبوعي مابيتختارش أصلًا.** طلب الابن مافيهوش
 *        يوم ولا ساعة، فولي الأمر كان بيدفع والميعاد فاضي، والجلسات
 *        تتجدول بعدين من أول خانة فاضية في جدول المدرب.
 *      • المدرب بيتثبّت على اختيار الابن بلا فرصة مراجعة في شاشته.
 *
 *    والقرار المنتجي: **ولي الأمر بيطلب من الأول زي أي عميل**،
 *    والفرق الوحيد إن اختيارات الابن بتيجي **مختارة سلفًا** — لأن
 *    الطلب جه منه. فهو بيراجع ويعدّل ويكمّل، مش بيوقّع على ورقة
 *    نص فاضية.
 *
 * **التعديل قبل الموافقة**: ولي الأمر يقدر يبعت مقدّم خدمة أو مدرب
 * مختلف عن اللي الابن طلبه — الرابط بيتبني على اللي هو اختاره.
 *
 * ── والتعديل مكانه المسار نفسه ──────────────────────────────
 *
 * كان فيه باراميتر `overrides` هنا عشان ولي الأمر يبعت مدربًا أو
 * مقدّم خدمة مختلفًا **وقت الموافقة**. اتشال.
 *
 * السبب إنه بقى بلا معنى: ولي الأمر دلوقتي بيدخل المسار من أوله
 * ويقدر يغيّر **كل حاجة** — الباقة والمدرب والميعاد، أو مقدّم
 * الخدمة — في شاشاتها الطبيعية. نموذج تعديل مصغّر جنب زرار
 * الموافقة كان هيبقى **مكانًا تانيًا لنفس القرار**، والاتنين
 * بيفترقوا مع الوقت.
 *
 * ⚠️ وكان **كود ميت** كمان: مفيش ولا موضع في الموقع كله بينادي
 *    الدالة دي بـ`overrides`. شاشة «طلبات الأبناء» فيها «اعتماد»
 *    و«رفض» وبس.
 */
export async function approveDependentRequest(
  requestId: string,
): Promise<ApprovedTarget> {
  const ctx = await loadGuardianRequest(requestId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, request, supabase } = ctx;

  if (request.status !== 'pending') {
    return { ok: false, error: 'الطلب ده اتبتّ فيه خلاص' };
  }

  const { data: updated, error } = await supabase
    .from('dependent_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Error approving dependent request', error);
    return { ok: false, error: `تعذّر قبول الطلب: ${error.message}` };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'الطلب اتغيّر قبل ما توافق — حدّث الصفحة.' };
  }

  const child = request.child_profiles as { full_name: string; account_profile_id: string | null } | null;

  if (child?.account_profile_id) {
    await notifyUser({
      event: 'service_order_new',
      recipientProfileId: child.account_profile_id,
      title: 'ولي أمرك وافق على طلبك',
      message: 'جاري استكمال الطلب.',
      link: '/dashboard/student',
    });
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'dependent_request_approved',
    entityType: 'DependentRequest',
    entityId: requestId,
  });

  revalidatePath('/account/family/requests');

  // الرابط بيروح لنفس شاشة الطلب العادية، **ومعاه الابن**.
  //
  // من غير `child` كان ولي الأمر بيوصل للشاشة ولازم يختار «لأحد أفراد
  // العائلة» بإيده ويدوّر على الاسم — يعني ممكن يكمّل الطلب باسمه هو
  // بالغلط، والخدمة تتنفّذ على إنها له. الموافقة لازم تربط، مش تسلّم
  // يدويًا.
  // ⭐ ملف 16 (#ATWG): قصة أو كتاب ← معالج التخصيص بتاعها من أوله.
  //    ولي الأمر بيختار الابن في أول خطوة ويكمّل التخصيص والدفع زي أي طلب.
  if (request.kind === 'product') {
    const productId = (request as { product_id?: string | null }).product_id;
    const { data: product } = productId
      ? await supabase.from('personalized_products').select('slug, category').eq('id', productId).maybeSingle()
      : { data: null };
    const path = product ? customizationPath(product.category, product.slug) : null;
    return { ok: true, href: path?.href ?? '/enha-lak' };
  }

  if (request.kind === 'service') {
    const providerId = request.provider_id;
    const params = new URLSearchParams({ child: request.child_profile_id });
    if (providerId) params.set('provider', providerId);
    // صفحة الخدمة — قايمة المقدّمين — مش شاشة الطلب. ولي الأمر يشوف
    // اختيار ابنه معلَّمًا وسطهم، ويقدر يغيّره قبل ما يكمّل.
    return {
      ok: true,
      href: `/creative-writing/services/${request.service_id}?${params.toString()}`,
    };
  }

  const params = new URLSearchParams({
    package: String(request.package_id),
    child: request.child_profile_id,
  });
  const instructorId = request.instructor_id;
  if (instructorId) params.set('instructor', instructorId);
  // معالج الحجز من خطوته الأولى — الباقة والمدرب مختارين سلفًا،
  // **والميعاد الأسبوعي لسه لازم يتحدد**. ده كان بيتخطّى خالص.
  return { ok: true, href: `/creative-writing/booking?${params.toString()}` };
}

/** ولي الأمر بيرفض، ومعاه سبب يوصل للابن. */
export async function rejectDependentRequest(
  requestId: string,
  guardianNote: string,
): Promise<RequestResult> {
  const ctx = await loadGuardianRequest(requestId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { guardian, request, supabase } = ctx;

  if (request.status !== 'pending') {
    return { ok: false, error: 'الطلب ده اتبتّ فيه خلاص' };
  }

  const note = guardianNote.trim();
  if (!note) {
    return { ok: false, error: 'اكتب سبب مختصر — الابن هيقراه.', field: 'note' };
  }

  const { data: updated, error } = await supabase
    .from('dependent_requests')
    .update({
      status: 'rejected',
      guardian_note: note,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Error rejecting dependent request', error);
    return { ok: false, error: `تعذّر رفض الطلب: ${error.message}` };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'الطلب اتغيّر قبل ما ترد — حدّث الصفحة.' };
  }

  const child = request.child_profiles as { account_profile_id: string | null } | null;
  if (child?.account_profile_id) {
    await notifyUser({
      event: 'service_order_new',
      recipientProfileId: child.account_profile_id,
      title: 'رد على طلبك',
      message: note,
      link: '/dashboard/student',
    });
  }

  await logAuditAction({
    actorProfileId: guardian.id,
    actorName: guardian.fullName,
    action: 'dependent_request_rejected',
    entityType: 'DependentRequest',
    entityId: requestId,
  });

  revalidatePath('/account/family/requests');
  return { ok: true };
}
