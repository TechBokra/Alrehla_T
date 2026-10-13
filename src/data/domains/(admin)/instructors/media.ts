import { createClient } from '@/lib/supabase/server';
import type { InstructorMedia, InstructorReviewGroup } from '@/data/domains/(shared)/instructors/media-types';
import { COLUMNS, toMedia } from '@/data/domains/(shared)/instructors/instructor-media-internal';

/**
 * كل صور المدرب بحالاتها — للوحة المدرب نفسه.
 *
 * ⚠️ السياسة بتسمح له بصفوفه هو وبس؛ الاستعلام مش محتاج يفلتر
 *    بالمستخدم، **ومابيعتمدش على ده وحده** — `instructorId` بييجي
 *    من `requireInstructor` في الأكشن.
 */
export async function getOwnInstructorMedia(
  instructorId: string,
): Promise<InstructorMedia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_media')
    .select(COLUMNS)
    .eq('instructor_id', instructorId)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('تعذّر قراءة صور المدرب', error);
    return [];
  }
  return (data ?? []).map(toMedia);
}

/**
 * المعلَّق كله — لشاشة المراجعة في الإدارة.
 *
 * ⚠️ بيرجّع اسم المدرب معاه: شاشة مراجعة بتعرض صورًا بلا أسماء
 *    بتخلّي الإداري يفتح تبويبًا تاني لكل صورة عشان يعرف بتاعة
 *    مين.
 */
export async function getPendingInstructorMedia(): Promise<
  (InstructorMedia & { instructorName: string })[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_media')
    .select(COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('تعذّر قراءة الصور المعلَّقة', error);
    return [];
  }

  const rows = (data ?? []).map(toMedia);
  if (rows.length === 0) return [];

  const { data: names } = await supabase
    .from('instructors')
    .select('id, display_name')
    .in('id', [...new Set(rows.map((r) => r.instructorId))]);

  const byId = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  return rows.map((r) => ({
    ...r,
    instructorName: byId.get(r.instructorId) ?? 'مدرب غير معروف',
  }));
}

/**
 * الصور اللي اتبتّ فيها (معتمدة ومرفوضة) — للإدارة.
 *
 * ⚠️ **ده اللي كان ناقص في شاشة «صور المدربين».** الشاشة كانت بتعرض
 *    المعلَّق بس — فأول ما الصورة تتعتمد بتختفي من الإدارة خالص،
 *    ومفيش طريقة تشوف إيه اللي ظاهر في صفحات المدربين ولا تسحب صورة
 *    اعتمدتها بالغلط.
 *
 * `instructorId` اختياري: من غيره كل المدربين (شاشة الصور)، ومعاه مدرب
 * واحد (صفحة المدرب في الإدارة) — وساعتها المعلَّق بييجي معاه.
 */
export async function getInstructorMediaForAdmin(
  instructorId?: string,
): Promise<(InstructorMedia & { instructorName: string })[]> {
  const supabase = await createClient();
  let query = supabase.from('instructor_media').select(COLUMNS);
  query = instructorId
    ? query.eq('instructor_id', instructorId)
    : query.neq('status', 'pending');

  const { data, error } = await query
    .order('instructor_id', { ascending: true })
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('تعذّر قراءة صور المدربين', error);
    return [];
  }

  const rows = (data ?? []).map(toMedia);
  if (rows.length === 0) return [];

  const { data: names } = await supabase
    .from('instructors')
    .select('id, display_name')
    .in('id', [...new Set(rows.map((r) => r.instructorId))]);

  const byId = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  return rows.map((r) => ({
    ...r,
    instructorName: byId.get(r.instructorId) ?? 'مدرب غير معروف',
  }));
}

export async function getInstructorReviewGroups(): Promise<InstructorReviewGroup[]> {
  const supabase = await createClient();
  const [{ data: reqRows, error: reqError }, { data: mediaRows, error: mediaError }] =
    await Promise.all([
      supabase
        .from('profile_update_requests')
        .select('id, instructor_id, requested_changes, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('instructor_media')
        .select(COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);

  if (reqError) console.error('تعذّر قراءة طلبات تعديل الملفات', reqError);
  if (mediaError) console.error('تعذّر قراءة الصور المعلَّقة', mediaError);

  const ids = [
    ...new Set([
      ...(reqRows ?? []).map((r) => r.instructor_id),
      ...(mediaRows ?? []).map((m) => m.instructor_id),
    ]),
  ];
  if (ids.length === 0) return [];

  const { data: instructors } = await supabase
    .from('instructors')
    .select('id, user_id, display_name, bio, specialties, years_experience, status')
    .in('id', ids);

  const userIds = (instructors ?? []).map((i) => i.user_id).filter(Boolean);
  const { data: profiles } = userIds.length
    ? await supabase.from('user_profiles').select('id, avatar_url').in('id', userIds)
    : { data: [] as { id: string; avatar_url: string | null }[] };
  const avatarByUser = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));

  const byId = new Map((instructors ?? []).map((i) => [i.id, i]));

  return ids.map((id) => {
    const inst = byId.get(id);
    return {
      instructorId: id,
      displayName: inst?.display_name ?? 'مدرب غير معروف',
      bio: inst?.bio ?? '',
      specialties: inst?.specialties ?? [],
      yearsExperience: inst?.years_experience ?? 0,
      status: inst?.status ?? '',
      avatarUrl: inst ? (avatarByUser.get(inst.user_id) ?? null) : null,
      requests: (reqRows ?? [])
        .filter((r) => r.instructor_id === id)
        .map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          requestedChanges: (r.requested_changes ?? {}) as Record<string, unknown>,
        })),
      media: (mediaRows ?? []).filter((m) => m.instructor_id === id).map(toMedia),
    };
  });
}
