'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditAction } from '@/lib/audit';
import { generateTempCode, MUST_SET_PASSWORD } from '@/lib/first-login';

/**
 * إضافة مدرب من لوحة الإدارة.
 *
 * مدرب = حساب دخول + صف في جدول المدربين. العمودان مربوطان: جدول المدربين
 * بيشترط `user_id`، فمفيش مدرب من غير حساب.
 *
 * الدالة بتغطي الحالتين:
 *   - الشخص مسجَّل بالفعل → بنحوّل دوره لمدرب وبننشئ صف المدرب،
 *     **وكلمة مروره ما بتتلمسش** — هو داخل بيها خلاص
 *   - الشخص جديد → بنعمل الحساب **برمز مؤقت** ترجعه الشاشة للإدارة
 *     عشان تبعته للمدرب. وأول ما يدخل بيه، الموقع بيوقفه على شاشة
 *     «حط كلمة مرورك» قبل أي حاجة تانية (`src/lib/first-login.ts`)
 *
 * ⚠️ **كان رابط دعوة، واتغيّر بقرار.** الرابط مفتاح حساب كامل، طويل
 *    وصعب النقل على واتساب، وبينتهي بمدة — فالمدرب اللي يفتحه متأخر
 *    كان محتاج دعوة جديدة. والرمز المؤقت بيدّي نفس النتيجة: المدرب
 *    هو اللي بيحدّد كلمة مروره في الآخر، ومفيش كلمة مرور دائمة
 *    بتعرفها الإدارة.
 *
 * المدرب الجديد بيبدأ بحالة «قيد التدريب» وتدريب غير مجتاز — مش «نشط».
 * إنه يظهر للعملاء قرار منفصل بياخده المسؤول بعد ما يخلّص تدريبه.
 */
export async function createInstructor(params: {
  email: string;
  fullName: string;
  displayName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  workModel: 'monthly' | 'per_session';
  password?: string;
}) {
  const admin = await requireAdmin('canManageInstructors', 'غير مصرح لك بإضافة مدربين');

  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const displayName = params.displayName.trim() || fullName;
  const typedPassword = params.password?.trim() ?? '';

  if (!email || !email.includes('@')) throw new Error('اكتب بريدًا إلكترونيًا صحيحًا');
  if (!fullName) throw new Error('اكتب اسم المدرب');
  if (typedPassword && typedPassword.length < 8) {
    throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }

  const supabaseAdmin = createAdminClient();

  // هل الشخص مسجَّل بالفعل؟ لو أيوه، دعوة تانية هتفشل بلا داعٍ.
  const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = existingList?.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  let userId: string;
  let invited = false;
  let tempCode: string | null = null;

  if (existing) {
    userId = existing.id;

    // له صف مدرب بالفعل؟
    const { data: already } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (already) {
      throw new Error('الشخص ده مسجَّل كمدرب بالفعل');
    }
  } else {
    const code = typedPassword || generateTempCode();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: code,
      // مفعّل فورًا: مفيش بريد تأكيد بيتبعت، والإدارة هي اللي بتسلّم
      // الرمز بإيدها. ومن غير ده الحساب يتعمل ويقف برّه.
      email_confirm: true,
      user_metadata: { full_name: fullName },
      // ⚠️ **العلامة في `app_metadata` لا `user_metadata`**: التانية
      //    المستخدم يعدّلها من المتصفح بنداء واحد، فكان هيشيلها
      //    ويعدّي الشاشة وهو لسه على الرمز المؤقت.
      app_metadata: { [MUST_SET_PASSWORD]: true },
    });
    if (error) {
      console.error('Error creating instructor account', error);
      if (error.message?.toLowerCase().includes('already')) {
        throw new Error('فيه حساب بالبريد ده بالفعل');
      }
      throw new Error('تعذّر إنشاء الحساب');
    }
    if (!data.user?.id) {
      throw new Error('تعذّر إنشاء الحساب');
    }
    userId = data.user.id;
    tempCode = code;
    invited = true;
  }

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .upsert({ id: userId, full_name: fullName, role: 'instructor' }, { onConflict: 'id' });

  if (profileError) {
    console.error('Error setting instructor profile', profileError);
    throw new Error('تعذّر حفظ بيانات المستخدم');
  }

  const { data: created, error: instructorError } = await supabaseAdmin
    .from('instructors')
    .insert({
      user_id: userId,
      display_name: displayName,
      bio: params.bio.trim(),
      specialties: params.specialties,
      years_experience: Number(params.yearsExperience) || 0,
      status: 'pending_training',
      training_passed: false,
      work_model: params.workModel,
    })
    .select('id')
    .single();

  if (instructorError || !created) {
    console.error('Error creating instructor', instructorError);
    throw new Error('تعذّر إنشاء ملف المدرب');
  }

  // ── صف مقدّم الخدمة المرتبط بالمدرب ───────────────────────
  //
  // ⚠️ **كان `try/catch` حوالين نداء Supabase — وده مش بيمسك حاجة.**
  //
  //    عميل Supabase **مبيرميش**: بيرجّع `{ error }`. فالـ`catch`
  //    مكانش بيتنفّذ أبدًا، و`error` محدّش كان بيقراه. يعني الإدراج
  //    يفشل، والمدرب يتعمل بلا صف مقدّم خدمة، ومحدّش يعرف —
  //    **والـ`catch` بيدّي إحساس زائف إن الحالة متعالَجة**.
  //
  // ⚠️ **والفشل هنا مش بيوقّع إنشاء المدرب.** المدرب اتعمل فعلًا
  //    والرمز المؤقت في إيد الإدارة؛ الرمي هنا كان هيدّيها رسالة خطأ
  //    على عملية **تمّت** ويخلّيها تعيد الإنشاء فيطلع حسابان.
  //    فبنرجّع العلامة والشاشة تقولها.
  const { error: providerError } = await supabaseAdmin
    .from('service_providers')
    .insert({
      kind: 'instructor',
      instructor_id: created.id,
      display_name: displayName,
      bio: params.bio.trim(),
      status: 'pending',
    });

  if (providerError) {
    console.error('Failed to create linked service_provider row', providerError);
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'instructor_created',
    entityType: 'Instructor',
    entityId: created.id,
    metadata: { email, invited, isCustomPassword: Boolean(typedPassword) },
  });

  revalidatePath('/dashboard/admin/instructors');
  revalidatePath('/creative-writing/instructors');

  return {
    ok: true,
    instructorId: created.id,
    invited,
    tempCode,
    // فاضية = اتعمل. النص ده بيتعرض للإدارة كتنبيه أصفر لا كخطأ.
    providerWarning: providerError
      ? 'المدرب اتعمل، بس صف «مقدّم الخدمة» بتاعه ما اتعملش — مش هيقدر يعرض خدمات إبداعية لحد ما الإدارة تضيفه من شاشة مقدّمي الخدمة.'
      : null,
  };
}

/**
 * إعادة تعيين أو منح كلمة مرور دخول جديدة للمدرب من لوحة الإدارة.
 *
 * مفيد للمدربين المتعثرين الذين نسوا كلمة المرور أو يواجهون مشاكل في الدخول.
 * يمكن للإدارة إما توليد رمز مؤقت آمن أو إدخال كلمة مرور مخصصة.
 * في الحالتين يتم فرض شاشة تعيين كلمة المرور (MUST_SET_PASSWORD) عند أول تسجيل دخول
 * لضمان خصوصية المدرب وحماية حسابه.
 */
export async function resetInstructorPassword(params: {
  instructorId: string;
  customPassword?: string;
}): Promise<{ ok: true; email: string; tempCode: string; isCustom: boolean }> {
  const admin = await requireAdmin('canManageInstructors', 'غير مصرح لك بإدارة حسابات المدربين');

  const supabaseAdmin = createAdminClient();

  // جلب صف المدرب
  const { data: instructor, error: instructorError } = await supabaseAdmin
    .from('instructors')
    .select('id, user_id, display_name')
    .eq('id', params.instructorId)
    .single();

  if (instructorError || !instructor || !instructor.user_id) {
    throw new Error('المدرب غير موجود أو ليس لديه حساب مستخدم مرتبط');
  }

  // ⚠️ **نفس باب رفع الصلاحيات بتاع `resetUserPassword`.**
  //
  //    `canManageInstructors` عند المشرف العام كمان. ولو حساب إداري
  //    كان مربوطًا بصف مدرب — وده وارد: إداري بيدرّب كمان — كان
  //    المشرف يعيّن كلمة مروره ويدخل مكانه من الباب ده.
  const { data: ownerProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', instructor.user_id)
    .maybeSingle();

  const ownerRole = ownerProfile?.role ?? 'customer';
  if (
    (ownerRole === 'super_admin' || ownerRole === 'general_supervisor') &&
    admin.role !== 'super_admin'
  ) {
    throw new Error('الحساب ده إداري — إعادة تعيين كلمة مروره متاحة لمدير النظام وحده.');
  }

  // جلب بيانات الحساب من Auth
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(instructor.user_id);
  if (userError || !userData?.user) {
    throw new Error('تعذّر العثور على حساب الدخول للمدرب');
  }

  const email = userData.user.email ?? '';
  const typed = params.customPassword?.trim() ?? '';
  if (typed && typed.length < 8) {
    throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
  }

  const password = typed || generateTempCode();

  // تحديث كلمة المرور ووضع علامة must_set_password في app_metadata
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(instructor.user_id, {
    password,
    app_metadata: { [MUST_SET_PASSWORD]: true },
  });

  if (updateError) {
    console.error('Error resetting instructor password', updateError);
    throw new Error(`تعذّر تعيين كلمة المرور: ${updateError.message}`);
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'instructor_password_reset',
    entityType: 'Instructor',
    entityId: instructor.id,
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
 * حساب مدرب من طلب انضمام مقبول — **والمدرب هو اللي بيكمّل ملفه**.
 *
 * الإدارة وقت القبول مش عارفة تخصصاته ولا سنين خبرته ولا نبذته. فالحساب
 * بيتعمل بالاسم والبريد اللي في الطلب بس، والملف فاضي عن قصد: أول ما
 * المدرب يدخل، لوحته بتوقفه على «كمّل ملفك» (`@/lib/instructor-onboarding`)،
 * والملف بيروح للإدارة تراجعه، وبعدها التدريب والتفعيل زي أي مدرب.
 *
 * ⚠️ **الحالة «قيد التدريب»** — فمايظهرش للأهالي ولا في معالج الحجز
 *    لحد ما الإدارة تفعّله بنفسها.
 *
 * والدخول برمز مؤقت (مش رابط دعوة) لنفس سبب `createInstructor`: الرمز
 * مابينتهيش بمدة، فالمدرب اللي يفتح الواتساب بعد يومين لسه يقدر يدخل.
 */
export async function createInstructorFromJoinRequest(
  requestId: string,
): Promise<
  | { ok: true; tempCode: string | null; email: string; name: string; warning: string | null }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin('canManageInstructors', 'غير مصرح لك بإضافة مدربين');
  } catch {
    return { ok: false, error: 'غير مصرح لك بإضافة مدربين' };
  }

  const supabase = await createClient();
  const { data: request } = await supabase
    .from('join_requests')
    .select('id, applicant_name, email, requested_role, status')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: 'الطلب مش موجود' };
  if (request.status !== 'approved') return { ok: false, error: 'اقبل الطلب الأول' };
  if (request.requested_role !== 'instructor') {
    return { ok: false, error: 'الطلب ده مش طلب مدرب' };
  }
  const email = (request.email ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'الطلب مافيهوش بريد — اعمل الحساب من شاشة المدربين' };

  try {
    const result = await createInstructor({
      email,
      fullName: request.applicant_name,
      displayName: request.applicant_name,
      // فاضي عن قصد — المدرب هو اللي بيملاه (ده اللي بيشغّل «كمّل ملفك»).
      bio: '',
      specialties: [],
      yearsExperience: 0,
      workModel: 'per_session',
    });
    return {
      ok: true,
      tempCode: result.tempCode,
      email,
      name: request.applicant_name,
      warning: result.providerWarning,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر إنشاء الحساب' };
  }
}
