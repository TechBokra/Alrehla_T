'use server';
import { requireAdmin, requireAnyAdmin } from '@/lib/auth-guard';

import { Instructor } from '@/types';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { notifyUser, getInstructorUserId, notifyAdmins } from '@/lib/notifications';
import { summarizeInstructorChangesText } from '@/lib/request-summary';
import { isProfileComplete, validateFirstProfile } from '@/lib/instructor-onboarding';

/**
 * Instructor profile changes, certification and pricing settings.
 *
 * Every action in this file used to mutate an in-memory array: the admin saw a
 * success message, and nothing was written anywhere. A restart erased it all.
 * These now write to the database, with the authorisation check done here for a
 * clear error and again by row-level security, which is the real guard.
 */

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireInstructorAdmin() {
  return requireAdmin('canManageInstructors', 'غير مصرح لك بإدارة المدربين');
}

/** The instructor must be asking about their own profile. */
async function requireOwnInstructorProfile(instructorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const { data } = await supabase
    .from('instructors')
    .select('id, display_name, bio, specialties')
    .eq('id', instructorId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) throw new Error('غير مصرح لك بتعديل هذا الملف');
  return {
    user,
    instructorName: data.display_name,
    // ملف ناقص = مدرب جديد جاي من طلب انضمام بيكمّل ملفه لأول مرة.
    isFirstProfile: !isProfileComplete(data),
  };
}

export async function submitInstructorProfileUpdate(
  instructorId: string,
  changes: Partial<Instructor>
) {
  const { user, instructorName, isFirstProfile } =
    await requireOwnInstructorProfile(instructorId);
  const supabase = await createClient();

  // ⚠️ **الملف الأول إلزامي كله** — والفحص هنا مش في الشاشة بس (قاعدة
  //    «ع»): من غيره نداء مباشر كان يبعت ملف فاضي للمراجعة. والصورة
  //    بتتقري من القاعدة (الشاشة بتحفظها قبل الطلب ده).
  if (isFirstProfile) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const problem = validateFirstProfile({
      displayName: changes.displayName ?? '',
      bio: changes.bio ?? '',
      specialties: changes.specialties ?? [],
      yearsExperience: Number(changes.yearsExperience),
      avatarUrl: profile?.avatar_url ?? '',
    });
    if (problem) throw new Error(problem);
  }

  const { error } = await supabase.from('profile_update_requests').insert({
    instructor_id: instructorId,
    requested_changes: changes as never,
    status: 'pending',
  });

  if (error) {
    console.error('Error submitting profile update request', error);
    throw new Error('تعذّر إرسال الطلب');
  }

  // تلخيص التغييرات التي تمت بدقة وإشعار الإدارة بها
  const summary = summarizeInstructorChangesText(changes);

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
  return { success: true };
}

/**
 * إرسال طلب مستقل لتعديل باقات التدريب المعتمدة للمدرب.
 * يذهب في طلب منفصل للادارة للموافقة عليه أو رفضه.
 */
export async function submitInstructorPackageUpdateRequest(
  instructorId: string,
  packageIds: string[]
) {
  const { instructorName } = await requireOwnInstructorProfile(instructorId);
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
    throw new Error('تعذّر إرسال طلب تعديل الباقات');
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
  return { success: true };
}

export async function approveProfileUpdateRequest(requestId: string) {
  const currentUser = await requireInstructorAdmin();
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from('profile_update_requests')
    .select('id, instructor_id, requested_changes, status')
    .eq('id', requestId)
    .single();

  if (readError || !request) throw new Error('الطلب غير موجود');
  if (request.status !== 'pending') throw new Error('تم البتّ في هذا الطلب من قبل');

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
      throw new Error('تعذّر حفظ تسعير المدرب — الطلب لسه معلّق.');
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
      throw new Error('تعذّر تطبيق باقات المدرب — الطلب لسه معلّق.');
    }
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
    throw new Error('تعذّر تطبيق التعديلات');
  }

  // صفر صفوف = المدرب مش موجود أو الصلاحيات رفضت بصمت. من غير الفحص
  // ده الطلب كان بيتقفل «تمت الموافقة» والمدرب ما اتغيّرش فيه حاجة.
  if (!updatedInstructor) {
    throw new Error('التعديلات مروّحتش للقاعدة — ملف المدرب مش موجود أو الصلاحيات مش سامحة.');
  }

  const { data: statusRows, error: statusError } = await supabase
    .from('profile_update_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('id')
    .maybeSingle();
  if (statusError) throw new Error('تعذّر تحديث حالة الطلب');
  if (!statusRows) {
    throw new Error('الطلب مش موجود أو اتقفل قبل كده.');
  }

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
  return { success: true };
}

export async function rejectProfileUpdateRequest(requestId: string, adminFeedback: string) {
  const currentUser = await requireInstructorAdmin();
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from('profile_update_requests')
    .select('id, instructor_id')
    .eq('id', requestId)
    .single();

  if (readError || !request) throw new Error('الطلب غير موجود');

  const { data: rejectedRows, error } = await supabase
    .from('profile_update_requests')
    .update({ status: 'rejected', admin_feedback: adminFeedback })
    .eq('id', requestId)
    .select('id');

  if (error) throw new Error('تعذّر تحديث حالة الطلب');
  if (!rejectedRows || rejectedRows.length === 0) {
    throw new Error('الطلب مش موجود أو اتقفل قبل كده.');
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
  return { success: true };
}

export async function updateInstructorCertification(instructorId: string, passed: boolean) {
  const currentUser = await requireInstructorAdmin();
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
    throw new Error('تعذّر حفظ حالة الاعتماد');
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
    throw new Error('الشهادة اتسجّلت بس حالة التدريب على ملف المدرب مااتحدّثتش.');
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
  return { success: true };
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
  revalidatePath('/creative-writing/instructors');
  // ⚠️ أهمهم: معالج الحجز هو اللي بيقرا القايمة.
  revalidatePath('/creative-writing/booking');

  const count = (data as { count?: number } | null)?.count ?? clean.length;
  return { ok: true, count };
}

export async function setInstructorStatus(
  instructorId: string,
  status: 'pending_training' | 'pending_approval' | 'active' | 'suspended',
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const currentUser = await requireInstructorAdmin();
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
  revalidatePath('/creative-writing/instructors');
  revalidatePath(`/creative-writing/instructors/${instructorId}`);
  // ⚠️ دي أهمهم: معالج الحجز هو اللي بيقرا القايمة، ومن غيرها
  //    المدرب المفعَّل يفضل مخفي عن ولي الأمر لحد ما الصفحة تتبني تاني.
  revalidatePath('/creative-writing/booking');
  return { ok: true, status };
}

export async function updatePricingFormulaSettings(
  platformMultiplier: number,
  fixedAdminFee: number
) {
  const user = await requireAnyAdmin(
    ['canManageCatalog', 'canManageInstructors'],
    'غير مصرح لك بتعديل إعدادات التسعير',
  );

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
    throw new Error('تعذّر حفظ إعدادات التسعير');
  }
  if (!formulaRows || formulaRows.length === 0) {
    throw new Error('إعدادات التسعير مروّحتش للقاعدة — الصلاحيات مش سامحة بالتعديل.');
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'pricing_formula_updated',
    entityType: 'PricingFormulaSettings',
    entityId: 'default',
    metadata: { platformMultiplier, fixedAdminFee },
  });

  revalidatePath('/dashboard/admin/settings/creative-writing-pricing');
  return { success: true };
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
) {
  const currentUser = await requireInstructorAdmin();
  const supabase = await createClient();

  const displayName = details.displayName.trim();
  if (!displayName) throw new Error('اسم المدرب مطلوب');
  if (!Number.isFinite(details.yearsExperience) || details.yearsExperience < 0) {
    throw new Error('سنوات الخبرة غير صحيحة');
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
    throw new Error('تعذّر حفظ بيانات المدرب');
  }
  if (!savedRows || savedRows.length === 0) {
    throw new Error('الحفظ مروّحش للقاعدة — المدرب مش موجود أو الصلاحيات مش سامحة.');
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
  revalidatePath('/creative-writing/instructors');
  revalidatePath(`/creative-writing/instructors/${instructorId}`);
  return { success: true };
}
