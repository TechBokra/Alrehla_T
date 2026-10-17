'use server';
import { requireAdmin, requireAnyAdmin } from '@/lib/auth-guard';

import { Instructor, type InstructorStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { notifyUser, getInstructorUserId, notifyAdmins } from '@/lib/notifications';
import { summarizeInstructorChangesText } from '@/lib/request-summary';
import { isProfileComplete, firstProfileProblem } from '@/lib/instructor-onboarding';
import { cairoLocalToIso } from '@/lib/promotions';
import { isUploadedImageUrl } from '@/lib/cloudinary';
import { cleanupReplacedImages } from '@/data/domains/(admin)/media/image-replacement';

/**
 * Instructor profile changes, certification and pricing settings.
 *
 * Every action in this file used to mutate an in-memory array: the admin saw a
 * success message, and nothing was written anywhere. A restart erased it all.
 * These now write to the database, with the authorisation check done here for a
 * clear error and again by row-level security, which is the real guard.
 */

/**
 * ⚠️ **دوال الإدارة في الملف ده بترجّع ولا بترمي** (قاعدة «هـ»). كانت
 *    بترمي، وNext بيمسح نصّ الاستثناء في الإنتاج — فالإداري كان بيشوف
 *    رسالة إنجليزي عامة بدل «سنوات الخبرة غير صحيحة» مثلًا.
 *    و`field` = اسم الخانة اللي عليها الخطأ، والشاشة بتعلّمها.
 *    ودوال المدرب نفسه (`submitInstructor…`) كمان بقت بترجّع بنفس الشكل.
 */
export type InstructorAdminResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): { ok: false; error: string; field?: string } =>
  field ? { ok: false, error, field } : { ok: false, error };

const DENIED = 'غير مصرح لك بإدارة المدربين';

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireInstructorAdmin() {
  // ⚠️ `requireAdmin` بترمي — فبتتلفّ هنا وترجع `null` (قاعدة «هـ»).
  try {
    return await requireAdmin('canManageInstructors', DENIED);
  } catch {
    return null;
  }
}

/**
 * The instructor must be asking about their own profile.
 *
 * ⚠️ بترجّع `{ ok: false, error }` بدل ما ترمي (قاعدة «هـ») — وكل نداء
 *    لازم يفحص `ok` ويرجع فورًا، وإلا الطلب يتبعت من غير تحقق.
 */
async function requireOwnInstructorProfile(instructorId: string): Promise<
  | {
      ok: true;
      user: { id: string };
      instructorName: string | null;
      isFirstProfile: boolean;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('يجب تسجيل الدخول أولاً');

  const { data } = await supabase
    .from('instructors')
    .select('id, display_name, bio, specialties')
    .eq('id', instructorId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return fail('غير مصرح لك بتعديل هذا الملف');
  return {
    ok: true,
    user,
    instructorName: data.display_name,
    // ملف ناقص = مدرب جديد جاي من طلب انضمام بيكمّل ملفه لأول مرة.
    isFirstProfile: !isProfileComplete(data),
  };
}

export async function submitInstructorProfileUpdate(
  instructorId: string,
  changes: Partial<Instructor>
): Promise<InstructorAdminResult> {
  const own = await requireOwnInstructorProfile(instructorId);
  if (!own.ok) return own;
  const { user, instructorName, isFirstProfile } = own;
  const supabase = await createClient();

  // ⚠️ **الملف الأول إلزامي كله** — والفحص هنا مش في الشاشة بس (قاعدة
  //    «ع»): من غيره نداء مباشر كان يبعت ملف فاضي للمراجعة. والصورة
  //    بتتقري من القاعدة (الشاشة بتحفظها قبل الطلب ده).
  //
  // ⚠️ **بس لو الطلب فيه بيانات الملف** (#ARWL في اختبار الإدارة): صفحة
  //    «الإعدادات» بتبعت المواعيد ونظام العمل لوحدهم، فالفحص كان
  //    بيرفضها دايمًا لمدرب ملفه ناقص — والرسالة كانت بتتخبّى.
  const touchesProfile = (['displayName', 'bio', 'specialties', 'yearsExperience'] as const).some(
    (k) => changes[k] !== undefined,
  );
  if (isFirstProfile && !touchesProfile) {
    return fail('كمّل ملفك الأول من «ملفي وصوري» وابعته للمراجعة — بعدها تقدر تبعت المواعيد.');
  }
  if (isFirstProfile) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const problem = firstProfileProblem({
      displayName: changes.displayName ?? '',
      bio: changes.bio ?? '',
      specialties: changes.specialties ?? [],
      yearsExperience: Number(changes.yearsExperience),
      avatarUrl: profile?.avatar_url ?? '',
    });
    if (problem) return fail(problem.error, problem.field);
  }

  // ── الصورة الشخصية (ملف 15) ──────────────────────────────
  //
  // الملف الأول: الصورة اتحفظت قبل الطلب ده، فمالهاش مكان فيه. بعد
  // التفعيل: بتتعتمد مع الطلب — بس لو صورة مرفوعة عندنا وفعلًا جديدة.
  const requested: Partial<Instructor> = { ...changes };
  delete requested.avatarUrl;
  if (!isFirstProfile && isUploadedImageUrl(changes.avatarUrl)) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (changes.avatarUrl !== profile?.avatar_url) requested.avatarUrl = changes.avatarUrl;
  }

  const { error } = await supabase.from('profile_update_requests').insert({
    instructor_id: instructorId,
    requested_changes: requested as never,
    status: 'pending',
  });

  if (error) {
    console.error('Error submitting profile update request', error);
    return fail('تعذّر إرسال الطلب');
  }

  // تلخيص التغييرات التي تمت بدقة وإشعار الإدارة بها
  const summary = summarizeInstructorChangesText(requested);

  await notifyAdmins({
    event: 'instructor_profile',
    title: isFirstProfile
      ? `مدرب جديد كمّل ملفه: ${instructorName || 'مدرب'} — راجعه وفعّله`
      : `طلب تعديل ملف: ${instructorName || 'مدرب'}`,
    message: summary,
    link: '/dashboard/admin/instructors/review',
  });

  revalidatePath('/dashboard/instructor', 'layout');
  revalidatePath('/dashboard/instructor/settings');
  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  return { ok: true };
}

/**
 * إرسال طلب مستقل لتعديل باقات التدريب المعتمدة للمدرب.
 * يذهب في طلب منفصل للادارة للموافقة عليه أو رفضه.
 */
export async function submitInstructorPackageUpdateRequest(
  instructorId: string,
  packageIds: string[]
): Promise<InstructorAdminResult> {
  const own = await requireOwnInstructorProfile(instructorId);
  if (!own.ok) return own;
  const { instructorName } = own;
  const supabase = await createClient();

  // جلب أسماء الباقات لتوضيح أسماء الباقات المطلوبة في إشعار الإدارة
  const { data: allPackages } = await supabase
    .from('creative_writing_packages')
    .select('id, name');

  const requestedChanges = {
    packageIds,
    _requestType: 'packages' as const,
  };

  const { error } = await supabase.from('profile_update_requests').insert({
    instructor_id: instructorId,
    requested_changes: requestedChanges as never,
    status: 'pending',
  });

  if (error) {
    console.error('Error submitting package update request', error);
    return fail('تعذّر إرسال طلب تعديل الباقات');
  }

  const summary = summarizeInstructorChangesText(requestedChanges, allPackages || []);

  await notifyAdmins({
    event: 'instructor_profile',
    title: `طلب اعتماد باقات: ${instructorName || 'مدرب'}`,
    message: summary,
    link: '/dashboard/admin/instructors/review',
  });

  revalidatePath('/dashboard/instructor/settings');
  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  return { ok: true };
}

export async function approveProfileUpdateRequest(
  requestId: string,
): Promise<InstructorAdminResult> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from('profile_update_requests')
    .select('id, instructor_id, requested_changes, status')
    .eq('id', requestId)
    .single();

  if (readError || !request) return fail('الطلب غير موجود');
  if (request.status !== 'pending') return fail('تم البتّ في هذا الطلب من قبل');

  const changes = (request.requested_changes ?? {}) as Partial<Instructor>;

  // Build the update from the requested changes only — never trust the payload
  // to carry fields the instructor is not allowed to change.
  const update: Database['public']['Tables']['instructors']['Update'] = {};

  // Profile details (bio, specialties, years of experience, display name).
  if (changes.displayName !== undefined) update.display_name = changes.displayName;
  if (changes.bio !== undefined) update.bio = changes.bio;
  if (changes.specialties !== undefined) update.specialties = changes.specialties;
  if (changes.yearsExperience !== undefined) {
    update.years_experience = changes.yearsExperience;
  }

  if (changes.workModel) update.work_model = changes.workModel;
  if (changes.weeklySchedule) update.weekly_schedule = changes.weeklySchedule as never;

  // ── التسعير: جدول تاني (SQL 122) ──────────────────────────
  //
  // ⚠️ **الأعمدة دي اتنقلت من `instructors`.** سياسة القراءة هناك
  //    `USING (true)` لكل مسجَّل، والصلاحيات بتحمي الصفوف لا
  //    الأعمدة (قاعدة «ب») — فأي حساب كان بيقرا تسعير كل المدربين.
  //
  // ⚠️ **وبتتكتب في نفس اللحظة اللي الطلب بيتوافق عليها**، لأن
  //    الموافقة هي اللي بتعتمد الرقم. `upsert` لأن المدرب القديم
  //    ممكن ما يكونش له صفّ بعد.
  const pricingUpdate: {
    instructor_id: string;
    approved_price?: number;
    requested_price?: number;
    monthly_hours_committed?: number;
    updated_at: string;
  } = { instructor_id: request.instructor_id, updated_at: new Date().toISOString() };
  let touchesPricing = false;

  if (changes.monthlyHoursCommitted !== undefined) {
    pricingUpdate.monthly_hours_committed = changes.monthlyHoursCommitted;
    touchesPricing = true;
  }
  if (changes.requestedPrice) {
    pricingUpdate.requested_price = changes.requestedPrice;
    pricingUpdate.approved_price = changes.requestedPrice;
    touchesPricing = true;
  }

  if (touchesPricing) {
    // ⚠️ بـ`select()`: الكتابة على صفر صفوف بتنجح في صمت (قاعدة
    //    «و») — والطلب كان هيتقفل «تمت الموافقة» والسعر ما اتغيّرش.
    const { data: savedPricing, error: pricingError } = await supabase
      .from('instructor_pricing')
      .upsert(pricingUpdate, { onConflict: 'instructor_id' })
      .select('instructor_id');

    if (pricingError || !savedPricing || savedPricing.length === 0) {
      console.error('Error saving instructor pricing', pricingError);
      return fail('تعذّر حفظ تسعير المدرب — الطلب لسه معلّق.');
    }
  }

  // كان هنا فرع تالت بياخد الحصيلة من «فئة سعر» ثابتة
  // (`instructor_pricing_options`). الفئات اتشالت من شاشة المدرب —
  // بيكتب رقمه بنفسه دلوقتي — فالفرع بقى بلا مصدر.

  // ── الباقات ───────────────────────────────────────────────
  //
  // ⚠️ **دي في جدول تاني، مش أعمدة على `instructors`** — فبتتطبّق
  //    بدالة بتستبدل الصفوف دفعة واحدة (ملف 102). لو اتعملت على
  //    خطوتين من هنا وفشلت التانية، المدرب يفضل **بلا ولا باقة** —
  //    يعني بقاعدتنا بيظهر في **كلها**، وهو عكس اللي اتوافق عليه.
  const requestedPackages = (changes as { packageIds?: string[] }).packageIds;
  if (Array.isArray(requestedPackages)) {
    const { error: packagesError } = await supabase.rpc('set_instructor_packages', {
      p_instructor_id: request.instructor_id,
      p_package_ids: requestedPackages,
    });
    if (packagesError) {
      console.error('Error applying approved packages', packagesError);
      return fail('تعذّر تطبيق باقات المدرب — الطلب لسه معلّق.');
    }
  }

  // ── الصورة الشخصية (ملف 15) ──────────────────────────────
  //
  // في حساب المدرب (`user_profiles`) مش في `instructors`. الإداري بيعدّي
  // حارس ملف 15. وبـ`select()` لأن الكتابة على صفر صفوف بتنجح في صمت.
  let replacedAvatar: string | null = null;
  if (isUploadedImageUrl(changes.avatarUrl)) {
    const instructorUserId = await getInstructorUserId(request.instructor_id);
    if (instructorUserId) {
      const previous = await supabase.from('user_profiles').select('avatar_url').eq('id', instructorUserId).maybeSingle();
      if (previous.error) return fail('تعذّر قراءة الصورة الحالية — الطلب لسه معلّق.');
      replacedAvatar = previous.data?.avatar_url ?? null;
    }
    const { data: savedAvatar, error: avatarError } = instructorUserId
      ? await supabase
          .from('user_profiles')
          .update({ avatar_url: changes.avatarUrl, updated_at: new Date().toISOString() })
          .eq('id', instructorUserId)
          .select('id')
      : { data: null, error: null };
    if (avatarError || !savedAvatar || savedAvatar.length === 0) {
      console.error('Error applying approved avatar', avatarError);
      return fail('تعذّر تطبيق الصورة الشخصية — الطلب لسه معلّق.');
    }
    refreshPublicPages();
  }

  update.updated_at = new Date().toISOString();
  const { data: updatedInstructor, error: updateError } = await supabase
    .from('instructors')
    .update(update)
    .eq('id', request.instructor_id)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('Error applying approved changes', updateError);
    return fail('تعذّر تطبيق التعديلات');
  }

  // صفر صفوف = المدرب مش موجود أو الصلاحيات رفضت بصمت. من غير الفحص
  // ده الطلب كان بيتقفل «تمت الموافقة» والمدرب ما اتغيّرش فيه حاجة.
  if (!updatedInstructor) {
    return fail('التعديلات مروّحتش للقاعدة — ملف المدرب مش موجود أو الصلاحيات مش سامحة.');
  }

  const { data: statusRows, error: statusError } = await supabase
    .from('profile_update_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('id')
    .maybeSingle();
  if (statusError) return fail('تعذّر تحديث حالة الطلب');
  if (!statusRows) {
    return fail('الطلب مش موجود أو اتقفل قبل كده.');
  }

  await cleanupReplacedImages([replacedAvatar]);

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'instructor_profile_update_approved',
    entityType: 'ProfileUpdateRequest',
    entityId: requestId,
    metadata: { instructorId: request.instructor_id },
  });

  await notifyUser({
    event: 'instructor_profile',
    recipientProfileId: await getInstructorUserId(request.instructor_id),
    title: 'تم اعتماد تعديلات ملفك',
    message: 'التعديلات التي أرسلتها ظاهرة الآن للطلاب.',
    link: '/dashboard/instructor/profile',
  });

  revalidatePath(`/dashboard/admin/instructors/${request.instructor_id}`);
  revalidatePath('/dashboard/admin/instructors/review');
  revalidatePath('/dashboard/instructor', 'layout');
  revalidatePath('/dashboard/instructor/settings');
  return { ok: true };
}

export async function rejectProfileUpdateRequest(
  requestId: string,
  adminFeedback: string,
): Promise<InstructorAdminResult> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from('profile_update_requests')
    .select('id, instructor_id')
    .eq('id', requestId)
    .single();

  if (readError || !request) return fail('الطلب غير موجود');

  const { data: rejectedRows, error } = await supabase
    .from('profile_update_requests')
    .update({ status: 'rejected', admin_feedback: adminFeedback })
    .eq('id', requestId)
    .select('id');

  if (error) return fail('تعذّر تحديث حالة الطلب');
  if (!rejectedRows || rejectedRows.length === 0) {
    return fail('الطلب مش موجود أو اتقفل قبل كده.');
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'instructor_profile_update_rejected',
    entityType: 'ProfileUpdateRequest',
    entityId: requestId,
    metadata: { instructorId: request.instructor_id, adminFeedback },
  });

  await notifyUser({
    event: 'instructor_profile',
    recipientProfileId: await getInstructorUserId(request.instructor_id),
    title: 'لم تُعتمد تعديلات ملفك',
    message: adminFeedback,
    link: '/dashboard/instructor/profile',
  });

  revalidatePath(`/dashboard/admin/instructors/${request.instructor_id}`);
  revalidatePath('/dashboard/admin/instructors/review');
  revalidatePath('/dashboard/instructor', 'layout');
  revalidatePath('/dashboard/instructor/settings');
  return { ok: true };
}

/**
 * موعد التدريب ورابطه ودرجة الاختبار.
 *
 * ── ليه الدالة دي اتضافت ────────────────────────────────────
 *
 * ⚠️ **الأعمدة التلاتة دي ماكانش فيه سطر واحد في المشروع بيكتبها.**
 *    `training_completed_at` و`training_meeting_link` و`exam_score`
 *    موجودين في القاعدة، وشاشة الإدارة **بتعرضهم**، وزرار الاعتماد
 *    بيكتب `exam_passed` وبس. يعني:
 *
 *      • الإدارة مالهاش طريقة تبعت للمدرب رابط التدريب
 *      • والدرجة اللي الشاشة بتعرضها عمرها ما بتتكتب
 *
 *    والمدرب في لوحته (شاشة «طريقك للظهور للعملاء») بيستنى الرابط
 *    ده بالظبط. فمن غير الدالة دي، الشاشة بتقول «الإدارة هتتواصل
 *    معاك» للأبد.
 *
 * ⚠️ **ومابتلمسش `exam_passed` ولا `training_passed`** — دول قرار
 *    الاعتماد وله دالته (`updateInstructorCertification`). فصلهم
 *    معناه إن الإدارة تقدر تجدّد موعد تدريب من غير ما تلمس حالة
 *    الاجتياز بالغلط.
 */
export async function setInstructorTraining(
  instructorId: string,
  input: { meetingLink?: string; completedAt?: string; examScore?: string },
): Promise<InstructorAdminResult> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);

  const link = (input.meetingLink ?? '').trim();
  // ⚠️ `https://` وبس: الرابط ده بيتحط للمدرب يدوس عليه من لوحته،
  //    و`javascript:` أو `http://` على زرار إحنا حاطينه مش مقبول.
  if (link && !link.startsWith('https://')) {
    return fail('رابط اللقاء لازم يبدأ بـ https://');
  }

  const completed = (input.completedAt ?? '').trim();
  let completedIso: string | null = null;
  if (completed) {
    const iso = cairoLocalToIso(completed) ?? (Number.isNaN(Date.parse(completed)) ? null : completed);
    if (!iso) return fail('تاريخ التدريب مش مقروء.');
    completedIso = iso;
  }

  const scoreText = (input.examScore ?? '').trim();
  let score: number | null = null;
  if (scoreText) {
    const n = Number(scoreText);
    if (!Number.isFinite(n) || n < 0 || n > 100) return fail('الدرجة لازم تكون رقم من 0 لـ 100.');
    score = Math.round(n);
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('instructor_certifications')
    .upsert(
      {
        instructor_id: instructorId,
        training_meeting_link: link || null,
        training_completed_at: completedIso,
        exam_score: score,
      },
      { onConflict: 'instructor_id' },
    )
    .select('id');

  if (error) {
    console.error('Error saving instructor training', error);
    return fail(`تعذّر حفظ بيانات التدريب: ${error.message}`);
  }
  // صفر صفوف من غير خطأ = الصلاحيات رفضت الكتابة بصمت (قاعدة «و»).
  if (!saved || saved.length === 0) {
    return fail('الحفظ مروّحش للقاعدة — صلاحيات جدول الاعتماد مش سامحة بالكتابة.');
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'instructor_training_updated',
    entityType: 'InstructorCertification',
    entityId: saved[0].id as string,
    metadata: { instructorId, hasLink: Boolean(link), completedAt: completedIso, score },
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  // ولوحة المدرب بتعرض الرابط والتاريخ دول.
  revalidatePath('/dashboard/instructor');
  return { ok: true };
}

export async function updateInstructorCertification(
  instructorId: string,
  passed: boolean,
): Promise<InstructorAdminResult> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from('instructor_certifications')
    .upsert(
      {
        instructor_id: instructorId,
        exam_passed: passed,
        certified_at: passed ? new Date().toISOString() : null,
      },
      { onConflict: 'instructor_id' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Error saving certification', error);
    return fail('تعذّر حفظ حالة الاعتماد');
  }

  // The instructor record carries the same flag, so keep the two in step.
  //
  // ده كان `await` من غير أي فحص — لا خطأ ولا عدد صفوف. يعني شهادة
  // بتتسجّل على المدرب وعمود `training_passed` عليه يفضل زي ما هو،
  // والشاشتين يقولوا حاجتين مختلفتين.
  const { data: flagRows, error: flagError } = await supabase
    .from('instructors')
    .update({ training_passed: passed, updated_at: new Date().toISOString() })
    .eq('id', instructorId)
    .select('id');

  if (flagError || !flagRows || flagRows.length === 0) {
    console.error('Error syncing instructor training flag', flagError);
    return fail('الشهادة اتسجّلت بس حالة التدريب على ملف المدرب مااتحدّثتش.');
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: passed ? 'instructor_certification_passed' : 'instructor_certification_failed',
    entityType: 'InstructorCertification',
    entityId: saved?.id ?? instructorId,
    metadata: { instructorId },
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  return { ok: true };
}

/**
 * تفعيل المدرب أو إيقافه.
 *
 * ── العطل ───────────────────────────────────────────────────
 *
 * ⚠️ **مفيش سطر واحد في المشروع كله كان بيكتب `instructors.status`.**
 *
 *    `createInstructor` بتعمله بحالة `pending_training`، وشاشة
 *    الإدارة فيها خانة «اجتاز التدريب والاختبار» — وهي بتكتب في
 *    `training_passed` **وبس**. فالحالة بتفضل `pending_training`
 *    للأبد.
 *
 *    ومعالج الحجز بيفلتر `status === 'active'`. يعني:
 *
 *        **ولا مدرب واحد كان بيظهر لولي الأمر، مهما عملت الإدارة.**
 *
 *    والإدارة مكانش عندها أي طريق تعرف ده منه: الخانة اتظبطت،
 *    والشاشة قالت «تم»، والمدرب مختفي.
 *
 * ── القاعدة ─────────────────────────────────────────────────
 *
 * ⚠️ **مفيش تفعيل قبل اجتياز التدريب.** الفحص هنا على الخادم لا في
 *    الشاشة (قاعدة «ع»)، وبيقرا `training_passed` **من القاعدة** لا
 *    من اللي الشاشة بعتته (قاعدة «ف»).
 */
/**
 * تحديد باقات المدرب من لوحة الإدارة مباشرة.
 *
 * المدرب بيقترح من لوحته والإدارة توافق (نفس نمط طلبات تعديل الملف)،
 * والدالة دي للإدارة لما تحب تحدّد بنفسها من غير انتظار اقتراح.
 *
 * ⚠️ **المصفوفة الفاضية معناها «كل الباقات»** لا «ولا باقة» —
 *    والشاشة بتقول ده بالنص عشان محدّش يفتكر إنه قفل المدرب.
 */
export async function setInstructorPackages(
  instructorId: string,
  packageIds: string[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const clean = Array.from(new Set((packageIds ?? []).filter((id) => typeof id === 'string' && id)));

  const { data, error } = await supabase.rpc('set_instructor_packages', {
    p_instructor_id: instructorId,
    p_package_ids: clean,
  });

  if (error) {
    console.error('Error setting instructor packages', error);
    return { ok: false, error: 'تعذّر حفظ باقات المدرب.' };
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'instructor_packages_set',
    entityType: 'Instructor',
    entityId: instructorId,
    metadata: { count: clean.length, packageIds: clean },
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  refreshPublicPages();
  // ⚠️ أهمهم: معالج الحجز هو اللي بيقرا القايمة.

  const count = (data as { count?: number } | null)?.count ?? clean.length;
  return { ok: true, count };
}

export async function setInstructorStatus(
  instructorId: string,
  status: InstructorStatus,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from('instructors')
    .select('id, display_name, training_passed, status')
    .eq('id', instructorId)
    .maybeSingle();

  if (readError || !current) {
    console.error('Error reading instructor before status change', readError);
    return { ok: false, error: 'المدرب ده مش موجود' };
  }

  if (status === 'active' && !current.training_passed) {
    return {
      ok: false,
      error: 'مينفعش تفعّله قبل ما يجتاز التدريب والاختبار. اظبط الخانة الأول.',
    };
  }

  const { data: rows, error } = await supabase
    .from('instructors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', instructorId)
    .select('id');

  // ⚠️ `UPDATE` على صفر صفوف بينجح (قاعدة «و») — فبنفحص العدد.
  if (error || !rows || rows.length === 0) {
    console.error('Error updating instructor status', error);
    return { ok: false, error: 'الحفظ مروّحش للقاعدة — راجع الصلاحيات.' };
  }

  // ⚠️ **حالته كمقدّم خدمة بتمشي معاه** (#SGCB في اختبار الإدارة): صف
  //    مقدّم الخدمة بيتعمل «مستني» مع المدرب، وماكانش بيتفعّل لما المدرب
  //    يتفعّل — فعروضه المعتمدة كانت بتتشال من صفحة الخدمات («قريبًا»)
  //    من غير ما حد يعرف.
  // ⚠️ **«مخفي» بتخفي عروضه كمقدّم خدمة كمان.** لو فضل `active` كمقدّم،
  //    المدرب يختفي من صفحة المدربين وخدماته تفضل معروضة للبيع — يعني
  //    الإخفاء اتعمل ونُصّه ما اتنفّذش.
  const providerStatus =
    status === 'active'
      ? 'active'
      : status === 'suspended' || status === 'hidden'
        ? 'suspended'
        : 'pending';
  const { error: providerError } = await supabase
    .from('service_providers')
    .update({ status: providerStatus, updated_at: new Date().toISOString() })
    .eq('instructor_id', instructorId);
  if (providerError) console.error('Error syncing provider status', providerError);

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: `instructor_status_${status}`,
    entityType: 'Instructor',
    entityId: instructorId,
    metadata: { from: current.status, to: status, name: current.display_name },
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/instructors');
  refreshPublicPages();
  // ⚠️ دي أهمهم: معالج الحجز هو اللي بيقرا القايمة، ومن غيرها
  //    المدرب المفعَّل يفضل مخفي عن ولي الأمر لحد ما الصفحة تتبني تاني.
  return { ok: true, status };
}

export async function updatePricingFormulaSettings(
  platformMultiplier: number,
  fixedAdminFee: number
): Promise<{ ok: true } | { ok: false; error: string; field?: 'platformMultiplier' | 'fixedAdminFee' }> {
  // ⚠️ بترجّع ولا بترمي (قاعدة «هـ») — رسالة الصلاحية كانت بتوصل ممسوحة.
  let user;
  try {
    user = await requireAnyAdmin(
      ['canManageCatalog', 'canManageInstructors'],
      'غير مصرح لك بتعديل إعدادات التسعير',
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح لك بتعديل إعدادات التسعير' };
  }

  // ⚠️ **فحص الأرقام على الخادم** — زي تسعير الناشرين بالظبط. كانت بتتحفظ
  //    زي ما هي: خانة فاضية = `NaN`، أو مضاعف صفر = كل جلسة بالرسوم الثابتة
  //    بس، أو سالب = سعر بالسالب. والمعادلة دي بتحدد سعر كل جلسة وخدمة.
  if (!Number.isFinite(platformMultiplier) || platformMultiplier <= 0) {
    return { ok: false, error: 'مضاعف المنصة لازم يكون رقمًا أكبر من صفر', field: 'platformMultiplier' };
  }
  if (platformMultiplier > 10) {
    return { ok: false, error: 'مضاعف المنصة كبير بشكل غير منطقي (أكتر من ١٠)', field: 'platformMultiplier' };
  }
  if (!Number.isFinite(fixedAdminFee) || fixedAdminFee < 0) {
    return { ok: false, error: 'الرسوم الثابتة لازم تكون صفرًا أو أكتر', field: 'fixedAdminFee' };
  }

  const supabase = await createClient();
  // `upsert` مش `update`: صف `default` ممكن ما يكونش موجود أصلًا في
  // قاعدة جديدة، و`UPDATE` على صف مش موجود بينجح ويغيّر **صفر** صفوف —
  // فالشاشة تقول «اتحفظ» والمعادلة تفضل على القيم الافتراضية، وكل سعر
  // خدمة بيتحسب غلط بعد كده.
  const { data: formulaRows, error } = await supabase
    .from('pricing_formula_settings')
    .upsert(
      {
        id: 'default',
        platform_multiplier: platformMultiplier,
        fixed_admin_fee: fixedAdminFee,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id');

  if (error) {
    console.error('Error updating pricing formula', error);
    return { ok: false, error: 'تعذّر حفظ إعدادات التسعير' };
  }
  if (!formulaRows || formulaRows.length === 0) {
    return { ok: false, error: 'إعدادات التسعير مروّحتش للقاعدة — الصلاحيات مش سامحة بالتعديل.' };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'pricing_formula_updated',
    entityType: 'PricingFormulaSettings',
    entityId: 'default',
    metadata: { platformMultiplier, fixedAdminFee },
  });

  revalidatePath('/dashboard/admin/settings/pricing');
  // المعادلة بتغيّر أسعار المدربين اللي ظاهرة للزوّار.
  refreshPublicPages();
  return { ok: true };
}

/**
 * An admin editing an instructor's public profile directly.
 *
 * The instructor's own edits go through `profile_update_requests` for review;
 * an admin with canManageInstructors edits in place, so existing instructor
 * cards can be filled in without waiting for each instructor to log in.
 */
export async function updateInstructorProfileByAdmin(
  instructorId: string,
  details: {
    displayName: string;
    bio: string;
    specialties: string[];
    yearsExperience: number;
  }
): Promise<InstructorAdminResult> {
  const currentUser = await requireInstructorAdmin();
  if (!currentUser) return fail(DENIED);
  const supabase = await createClient();

  const displayName = details.displayName.trim();
  if (!displayName) return fail('اسم المدرب مطلوب', 'displayName');
  if (!Number.isFinite(details.yearsExperience) || details.yearsExperience < 0) {
    return fail('سنوات الخبرة غير صحيحة', 'yearsExperience');
  }

  const { data: savedRows, error } = await supabase
    .from('instructors')
    .update({
      display_name: displayName,
      bio: details.bio.trim(),
      specialties: details.specialties,
      years_experience: details.yearsExperience,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instructorId)
    .select('id');

  if (error) {
    console.error('Error updating instructor profile', error);
    return fail('تعذّر حفظ بيانات المدرب');
  }
  if (!savedRows || savedRows.length === 0) {
    return fail('الحفظ مروّحش للقاعدة — المدرب مش موجود أو الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'instructor_profile_edited_by_admin',
    entityType: 'Instructor',
    entityId: instructorId,
    metadata: { displayName, yearsExperience: details.yearsExperience },
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/instructors');
  refreshPublicPages();
  return { ok: true };
}

/**
 * نقل شغل مدرب لمدرب تاني.
 *
 * ⚠️ **الإيقاف لوحده كان بيسيب الأهالي بلا مدرب.** الجلسات المحجوزة
 *    بتفضل مسنودة لمدرب موقوف، ومفيش أي شاشة في الموقع بتغيّر مدرب
 *    جلسة — `updateSessionDetails` بتغيّر الرابط والموعد وبس. فالعميل
 *    دافع، وميعاده قايم، ومفيش حد هيحضره.
 *
 * ⚠️ **الإشعارات هنا لا في القاعدة.** الدالة بتنقل الصفوف وبترجّع
 *    أرقامها؛ واللي لازم يعرف (المدرب الجديد، والقديم، والإدارة) بيتبلّغ
 *    من هنا. محفّز قاعدة مايعرفش يبعت إشعارات المنصة.
 */
export type TransferWorkResult =
  | {
      ok: true;
      fromName: string;
      toName: string;
      sessions: number;
      tasks: number;
      serviceOrders: number;
      blockedOrders: { id: string; status: string }[];
      sessionsRemaining: number;
    }
  | { ok: false; error: string };

export async function transferInstructorWork(
  fromInstructorId: string,
  toInstructorId: string,
): Promise<TransferWorkResult> {
  const admin = await requireInstructorAdmin();
  if (!admin) return { ok: false, error: DENIED };

  if (!fromInstructorId || !toInstructorId) {
    return { ok: false, error: 'اختار المدرب اللي هينتقل له الشغل' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('transfer_instructor_work', {
    p_from: fromInstructorId,
    p_to: toInstructorId,
  });

  if (error) {
    console.error('transferInstructorWork rpc', error);
    if (error.code === 'PGRST202') {
      return { ok: false, error: 'النقل محتاج ملف القاعدة 20261016150000 يتشغّل الأول' };
    }
    // ⚠️ كود القاعدة بيظهر للإداري عن قصد — «تعذّر» لوحدها خبّت
    //    `42883` يومًا كاملًا في «حذف المدرب».
    return { ok: false, error: `تعذّر نقل الشغل (${error.code ?? 'خطأ'}) — ابعت الكود ده للدعم.` };
  }

  const result = (data ?? null) as
    | {
        ok: true;
        fromName: string;
        toName: string;
        toUserId: string;
        fromUserId: string;
        sessions: number;
        tasks: number;
        serviceOrders: number;
        blockedOrders: { id: string; status: string }[];
        sessionsRemaining: number;
      }
    | { ok: false; error: string; status?: string }
    | null;

  if (!result) return { ok: false, error: 'تعذّر نقل الشغل' };

  if (!result.ok) {
    if (result.error === 'denied') return { ok: false, error: DENIED };
    if (result.error === 'same_instructor') return { ok: false, error: 'اختار مدربًا مختلفًا' };
    if (result.error === 'from_not_found' || result.error === 'to_not_found') {
      return { ok: false, error: 'واحد من المدربين مش موجود — حدّث الصفحة' };
    }
    if (result.error === 'to_not_active') {
      return {
        ok: false,
        error: 'المدرب اللي هتنقل له لازم يكون «نشط» — نقل الشغل لمدرب مخفي أو موقوف بينقل المشكلة مش بيحلّها.',
      };
    }
    return { ok: false, error: 'تعذّر نقل الشغل' };
  }

  const moved = result.sessions + result.tasks + result.serviceOrders;

  // المدرب الجديد لازم يعرف دلوقتي — عنده مواعيد النهاردة يمكن.
  if (moved > 0) {
    await notifyUser({
      event: 'session_update',
      recipientProfileId: result.toUserId,
      title: 'اتنقل لك شغل جديد',
      message: `${result.sessions} جلسة و${result.tasks} مهمة من ${result.fromName}. راجع جدولك.`,
      link: '/dashboard/instructor/sessions',
    });

    await notifyUser({
      event: 'session_update',
      recipientProfileId: result.fromUserId,
      title: 'اتنقل شغلك لمدرب تاني',
      message: `${result.sessions} جلسة و${result.tasks} مهمة اتنقلت لـ${result.toName}.`,
      link: '/dashboard/instructor/sessions',
    });
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'instructor_work_transferred',
    entityType: 'Instructor',
    entityId: fromInstructorId,
    metadata: {
      to: toInstructorId,
      sessions: result.sessions,
      tasks: result.tasks,
      serviceOrders: result.serviceOrders,
      blocked: result.blockedOrders.length,
      remaining: result.sessionsRemaining,
    },
  });

  revalidatePath(`/dashboard/admin/instructors/${fromInstructorId}`);
  revalidatePath(`/dashboard/admin/instructors/${toInstructorId}`);
  revalidatePath('/dashboard/admin/instructors');
  revalidatePath('/dashboard/instructor/sessions');

  return {
    ok: true,
    fromName: result.fromName,
    toName: result.toName,
    sessions: result.sessions,
    tasks: result.tasks,
    serviceOrders: result.serviceOrders,
    blockedOrders: result.blockedOrders ?? [],
    sessionsRemaining: result.sessionsRemaining,
  };
}
