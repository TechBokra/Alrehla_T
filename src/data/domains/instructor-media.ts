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
