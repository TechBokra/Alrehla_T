import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * صور بروفايل المدرب — غلاف وأعمال، بموافقة الإدارة (ملف 127).
 */

export type InstructorMediaKind = 'cover' | 'work';
export type InstructorMediaStatus = 'pending' | 'approved' | 'rejected';

export interface InstructorMedia {
  id: string;
  instructorId: string;
  kind: InstructorMediaKind;
  imageUrl: string;
  title: string | null;
  contribution: string | null;
  sortOrder: number;
  status: InstructorMediaStatus;
  adminFeedback: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  instructor_id: string;
  kind: string;
  image_url: string;
  title: string | null;
  contribution: string | null;
  sort_order: number;
  status: string;
  admin_feedback: string | null;
  created_at: string;
};

const toMedia = (r: Row): InstructorMedia => ({
  id: r.id,
  instructorId: r.instructor_id,
  kind: r.kind as InstructorMediaKind,
  imageUrl: r.image_url,
  title: r.title,
  contribution: r.contribution,
  sortOrder: r.sort_order,
  status: r.status as InstructorMediaStatus,
  adminFeedback: r.admin_feedback,
  createdAt: r.created_at,
});

const COLUMNS =
  'id, instructor_id, kind, image_url, title, contribution, sort_order, status, admin_feedback, created_at';

/**
 * المعتمَد وحده — للصفحة العامة.
 *
 * ⚠️ **بعميل بلا كوكيز عن قصد.** صفحة المدرب عامة، ولو قريناها
 *    بالعميل العادي كل صفحة مدرب بتبقى ديناميكية وبتتبني من الصفر
 *    مع كل زيارة — نفس السبب اللي خلّى الهيدر يبطّل يقرا المستخدم.
 *
 * ⚠️ **والسياسة هي اللي بتفلتر مش الاستعلام وحده.** حتى لو حد نسي
 *    `.eq('status','approved')`، سياسة الزائر بترجّع المعتمَد بس.
 *    الشرط هنا **تأكيد مزدوج** لا حماية وحيدة — لأن الصفوف
 *    الممنوعة بترجع فاضية لا بخطأ (قاعدة «ك»)، فالاعتماد على طرف
 *    واحد بيخلّي العطل صامتًا.
 */
export async function getPublicInstructorMedia(
  instructorId: string,
): Promise<{ cover: InstructorMedia | null; works: InstructorMedia[] }> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('instructor_media')
    .select(COLUMNS)
    .eq('instructor_id', instructorId)
    .eq('status', 'approved')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    // الصفحة بتفضل شغّالة بلا صور — الغلاف زينة، والمقال هو المحتوى.
    console.error('تعذّر قراءة صور المدرب', error);
    return { cover: null, works: [] };
  }

  const rows = (data ?? []).map(toMedia);
  return {
    cover: rows.find((m) => m.kind === 'cover') ?? null,
    works: rows.filter((m) => m.kind === 'work'),
  };
}

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

/**
 * كل اللي مستني مراجعة لكل مدرب — **ملفه وصوره في مكان واحد**.
 *
 * المدرب بيعدّل ملفه وصوره من صفحة واحدة («ملفي وصوري»)، فالإدارة
 * بتراجعهم من صفحة واحدة برضه: طلبات تعديل الملف (نبذة، تخصصات،
 * جدول، باقات…) والغلاف وصور الأعمال، متجمّعين بالمدرب، ومع كل مدرب
 * بياناته الحالية عشان المقارنة «قبل ← بعد».
 */
export type InstructorReviewGroup = {
  instructorId: string;
  displayName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  status: string;
  avatarUrl: string | null;
  requests: {
    id: string;
    createdAt: string;
    requestedChanges: Record<string, unknown>;
  }[];
  media: InstructorMedia[];
};

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
