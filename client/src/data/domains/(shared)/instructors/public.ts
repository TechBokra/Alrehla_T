import { PublicInstructor, InstructorStatus, WeeklySlot } from '@/types';
import type { QueryReadOptions } from '@/data/query-result';
import { createPublicClient } from '@/lib/supabase/public';

/** الصف كما ترجعه `public_instructors()` في القاعدة (ملف 83). */
type PublicInstructorRow = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  is_sample: boolean | null;
  status: string;
  weekly_schedule: unknown;
  avatar_url: string | null;
  package_ids: string[] | null;
};

function toPublicInstructor(row: PublicInstructorRow): PublicInstructor {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio ?? '',
    specialties: row.specialties ?? [],
    yearsExperience: row.years_experience ?? 0,
    isSample: row.is_sample ?? undefined,
    status: row.status as InstructorStatus,
    weeklySchedule: (row.weekly_schedule as WeeklySlot[]) ?? [],
    avatarUrl: row.avatar_url ?? undefined,
    // فاضية = كل الباقات (انظر `PublicInstructor.packageIds`).
    packageIds: row.package_ids ?? [],
  };
}

/**
 * المدرب ده يتعرض للزوار؟
 *
 * ⚠️ **`public_instructors()` في القاعدة مالهاش فلتر حالة خالص** —
 *    بترجّع كل صف في الجدول. والفلترة المفروض تحصل هنا، وما كانتش
 *    بتحصل في تلات أماكن: قايمة المدربين، وصفحة كل ملف، وخريطة
 *    الموقع. فحساب تجريبي ومدرب موقوف وملف فاضي من غير صورة ولا
 *    نبذة كانوا كلهم **معروضين على الموقع العام ومفهرَسين في جوجل**.
 *
 *    والفلترة مابتتعملش في دالة القاعدة عن قصد: نفس الدالة بتغذّي
 *    لوحة المدرب نفسه وشاشة الإدارة، وفلترتها هناك كانت هتقفل لوحة
 *    المدرب المخفي — وهو المفروض يفضل شغّال.
 *
 * `active` وحدها هي الظاهرة. `hidden` و`suspended` و`pending_*` لأ.
 */
export const isPubliclyVisible = (instructor: PublicInstructor): boolean =>
  instructor.status === 'active';

/**
 * قائمة المدربين **الخام** — بكل الحالات.
 *
 * ⚠️ مش للصفحات العامة. استعمل `getVisibleInstructors`.
 */
export const getPublicInstructors = async (options: QueryReadOptions = {}): Promise<PublicInstructor[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('public_instructors');
  if (error && options.throwOnError) throw error;

  if (error || !data) {
    // ⚠️ فاضي هنا معناه «مفيش مدربين» **أو** «الدالة مش موجودة» —
    //    قاعدة (ك). لو الصفحة طلعت فاضية بعد نشر، أول حاجة تتأكد منها
    //    إن ملف 83 اتشغّل على القاعدة.
    if (error) console.error('Error loading public instructors', error);
    return [];
  }

  return (data as unknown as PublicInstructorRow[]).map(toPublicInstructor);
};

/** مدرب واحد للصفحات العامة — بالأعمدة الآمنة وحدها. */
export const getPublicInstructorById = async (
  id: string,
  options: QueryReadOptions = {},
): Promise<PublicInstructor | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('public_instructor', { p_id: id });
  if (error && options.throwOnError) throw error;

  if (error) {
    console.error('Error loading public instructor', error);
    return null;
  }

  const row = (data as unknown as PublicInstructorRow[] | null)?.[0];
  return row ? toPublicInstructor(row) : null;
};

/**
 * المدربون الظاهرون للزوار — **دي اللي بتستعملها أي صفحة عامة**.
 *
 * `getPublicInstructors` بترجّع الكل بلا فلتر، وهي للوحة المدرب نفسه
 * وشاشة الإدارة وحدهم. اختبار `instructor-visibility.test.ts` بيفشل لو
 * صفحة عامة نادت الخام.
 */
export const getVisibleInstructors = async (
  options: QueryReadOptions = {},
): Promise<PublicInstructor[]> => (await getPublicInstructors(options)).filter(isPubliclyVisible);

/**
 * مدرب واحد للزوار — بيرجّع `null` لو مش ظاهر.
 *
 * ⚠️ **`null` هنا معناها «مش موجود» بالنسبة للزائر.** الصفحة بتعمل
 *    `notFound()` — مش بتعرض الملف برسالة «موقوف»، لأن ده بيأكّد وجوده
 *    لحد مالوش علاقة.
 */
export const getVisibleInstructorById = async (
  id: string,
  options: QueryReadOptions = {},
): Promise<PublicInstructor | null> => {
  const row = await getPublicInstructorById(id, options);
  return row && isPubliclyVisible(row) ? row : null;
};
