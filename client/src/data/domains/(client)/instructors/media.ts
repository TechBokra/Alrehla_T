import { createPublicClient } from '@/lib/supabase/public';
import type { InstructorMedia } from '@/data/domains/(shared)/instructors/media-types';
import { COLUMNS, toMedia } from '@/data/domains/(shared)/instructors/instructor-media-internal';

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
