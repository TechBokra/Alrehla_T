import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase/server';
import { Instructor } from '@/types';
import type { InstructorAdminRow } from '@/data/domains/(admin)/instructors/types';

/**
 * الأعمدة اللي تظهر للزائر — ومفيش غيرها.
 *
 * ⚠️ **متحطّش هنا عمود جديد من غير ما تسأل: هل ينفع أي زائر يقراه؟**
 *    كان الاستعلام `select('*')` بمفتاح الزائر، فـ`approved_price` و
 *    `requested_price` و`monthly_hours_committed` و`work_model` كانوا
 *    بيوصلوا للمتصفح في صفحة عامة. القايمة الصريحة هي اللي بتمنع ده.
 *
 * `weekly_schedule` موجود عن قصد: العميل محتاج يشوف المواعيد عشان يحجز.
 */
/* قايمة الأعمدة الصريحة اتشالت: المسار العام بقى بيعدّي على
   `public_instructors()` (ملف 83)، والأعمدة الآمنة اتحدّدت في **الدالة
   نفسها** مش في الكود. الفرق إن قايمة في الكود بتحدّد اللي الصفحة
   بتعرضه، والدالة بتحدّد اللي الزائر **يقدر يوصله** أصلًا. */

/**
 * صور المدربين — **مش في جدول `instructors` أصلًا**.
 *
 * ── العطل اللي ده بيقفله ────────────────────────────────────
 *
 * `Instructor.avatarUrl` موجود في النوع من زمان، وصفحة المدرب العامة
 * بتعرضه (`instructor.avatarUrl ? <Image .../> : <User />`). بس **مفيش
 * ولا استعلام واحد كان بيملاه**: جدول `instructors` مالوش عمود
 * `avatar_url` خالص. الصورة بتتحفظ في `user_profiles.avatar_url` —
 * حساب المستخدم، مش ملف المدرب.
 *
 * فالمدرب كان بيرفع صورته، وبتتحفظ صح، **وصفحته العامة ما بتعرضهاش
 * ولا مرة** — لأن الكود بيسأل عنها في الجدول الغلط. والصفحة كانت
 * بتقع على أيقونة الشخص الرمادية من غير أي رسالة خطأ.
 *
 * ⚠️ والزائر **يقدر** يقرا الصف ده: `can_see_profile(id)` فيها بند
 *    صريح «مدرب أو مقدّم خدمة: اسمه معروض على الموقع أصلًا»، والبند ده
 *    مش متوقف على `auth.uid()`. (وعشان كده ملف 82 ساب `can_see_profile`
 *    ممنوحة لـ`anon` عن قصد — سحبها كان هيكسر ده.)
 */
async function avatarsByUserId(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data } = await supabase
    .from('user_profiles')
    .select('id, avatar_url')
    .in('id', ids);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.avatar_url) map.set(row.id, row.avatar_url);
  }
  return map;
}

/**
 * كل بيانات المدرب — **للوحات فقط**.
 *
 * ⚠️ بتستخدم عميل المستخدم المسجَّل (`createClient`) مش مفتاح الزائر.
 *    كانت بتستخدم مفتاح الزائر، يعني شاشة «مستحقات المدربين» في لوحة
 *    الإدارة كانت بتقرا الأسعار بصلاحية **زائر غير مسجَّل** — وده اللي
 *    كان بيخلّي سياسة القراءة العامة على الجدول ضرورية للوحة تشتغل.
 *    بعد التغيير ده، الصفحات العامة بقت بتاخد الأعمدة الآمنة بس،
 *    واللوحات بتقرا بهوية صاحبها.
 */
/**
 * تسعير المدربين — **من `instructor_pricing` لا من `instructors`**.
 *
 * ⚠️ الأعمدة اتنقلت لجدول لوحده (SQL 122) لأن سياسة القراءة على
 *    `instructors` كانت `USING (true)` لكل مسجَّل، والصلاحيات
 *    بتحمي الصفوف لا الأعمدة (قاعدة «ب»).
 *
 * ⚠️ **والفاضي هنا مش عطل.** الجدول سياسته: الإدارة والمدرب نفسه
 *    وبس. فاللي بيقرا وهو مش واحد منهم بياخد خريطة فاضية —
 *    والشاشة بتعرض «غير محدد» بدل ما تقع. ده **المقصود**: مفيش
 *    شاشة لغير الإدارة والمدرب بتعرض الأرقام دي أصلًا.
 */
async function pricingByInstructorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { approved?: number; requested?: number; hours?: number }>> {
  const out = new Map<string, { approved?: number; requested?: number; hours?: number }>();
  if (ids.length === 0) return out;

  const { data, error } = await supabase
    .from('instructor_pricing')
    .select('instructor_id, approved_price, requested_price, monthly_hours_committed')
    .in('instructor_id', ids);

  // ⚠️ الرفض بيرجع فاضي لا بخطأ (قاعدة «ك») — بنسجّل الخطأ لو جه
  //    عشان «الأرقام مختفية» ما تتقريش على إنها «مفيش أسعار».
  if (error) {
    console.error('Error reading instructor pricing', error);
    return out;
  }

  for (const row of data ?? []) {
    out.set(row.instructor_id, {
      approved: row.approved_price ?? undefined,
      requested: row.requested_price ?? undefined,
      hours: row.monthly_hours_committed ?? undefined,
    });
  }
  return out;
}

export const getInstructors = async (): Promise<Instructor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('instructors')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  const [avatars, pricing] = await Promise.all([
    avatarsByUserId(
      supabase,
      data.map((inst: { user_id: string }) => inst.user_id),
    ),
    pricingByInstructorId(supabase, data.map((inst: { id: string }) => inst.id)),
  ]);

  return data.map((inst: any) => ({
    id: inst.id,
    userId: inst.user_id,
    displayName: inst.display_name,
    bio: inst.bio,
    specialties: inst.specialties,
    yearsExperience: inst.years_experience,
    isSample: inst.is_sample,
    status: inst.status,
    // الصورة من `user_profiles` مش من `instructors` — شوف `avatarsByUserId`.
    avatarUrl: avatars.get(inst.user_id),
    trainingPassed: inst.training_passed,
    workModel: inst.work_model,
    requestedPrice: pricing.get(inst.id)?.requested,
    selectedPricingOptionId: inst.selected_pricing_option_id || undefined,
    approvedPrice: pricing.get(inst.id)?.approved,
    weeklySchedule: (inst.weekly_schedule as any[]) || [],
    pendingSchedule: (inst.pending_schedule as any[]) || undefined,
    monthlyHoursCommitted: pricing.get(inst.id)?.hours,
  }));
};

/** كل بيانات المدرب الواحد — **للوحات فقط**. نفس سبب `getInstructors`. */
export const getInstructorById = async (
  id: string
): Promise<Instructor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('instructors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const [avatars, pricing] = await Promise.all([
    avatarsByUserId(supabase, [data.user_id]),
    pricingByInstructorId(supabase, [data.id]),
  ]);
  const price = pricing.get(data.id);

  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name,
    bio: data.bio,
    specialties: data.specialties,
    yearsExperience: data.years_experience,
    isSample: data.is_sample ?? undefined,
    status: data.status,
    // الصورة من `user_profiles` مش من `instructors` — شوف `avatarsByUserId`.
    avatarUrl: avatars.get(data.user_id),
    trainingPassed: data.training_passed ?? false,
    workModel: data.work_model,
    requestedPrice: price?.requested,
    selectedPricingOptionId: data.selected_pricing_option_id || undefined,
    approvedPrice: price?.approved,
    weeklySchedule: (data.weekly_schedule as any[]) || [],
    pendingSchedule: (data.pending_schedule as any[]) || undefined,
    monthlyHoursCommitted: price?.hours,
  };
};

export const getInstructorsForAdmin = async (): Promise<InstructorAdminRow[]> => {
  const instructors = await getInstructors();
  if (instructors.length === 0) return [];

  const supabase = await createClient();
  const ids = instructors.map((i) => i.id);

  const [{ data: pending }, { data: services }] = await Promise.all([
    supabase
      .from('profile_update_requests')
      .select('instructor_id')
      .eq('status', 'pending')
      .in('instructor_id', ids),
    // العدّ من `provider_services` عبر صف مقدّم الخدمة بتاع المدرب —
    // ده الجدول اللي العميل بيشوف منه. العدّ من `instructor_services`
    // كان بيدّي الإدارة رقمًا مالوش علاقة باللي معروض فعلًا.
    supabase
      .from('provider_services')
      .select('service_providers!inner(instructor_id)')
      .eq('status', 'approved')
      .eq('is_active', true)
      .in('service_providers.instructor_id', ids),
  ]);

  const pendingSet = new Set((pending ?? []).map((r) => r.instructor_id));
  const serviceCount = new Map<string, number>();
  for (const row of services ?? []) {
    const linked = row.service_providers as unknown as { instructor_id: string | null } | null;
    const id = linked?.instructor_id;
    if (!id) continue;
    serviceCount.set(id, (serviceCount.get(id) ?? 0) + 1);
  }

  return instructors.map((inst) => ({
    ...inst,
    hasPendingReview: pendingSet.has(inst.id),
    activeServicesCount: serviceCount.get(inst.id) ?? 0,
  }));
};
