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

/** قائمة المدربين للصفحات العامة — بالأعمدة الآمنة وحدها. */
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
