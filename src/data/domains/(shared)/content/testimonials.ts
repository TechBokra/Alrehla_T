import { Testimonial } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';

/** الأقسام اللي الرأي ممكن يظهر فيها. */
export type TestimonialLine = 'general' | 'enha_lak' | 'creative_writing';

/**
 * آراء العملاء — **بالقسم**.
 *
 * ── اللي كان بيحصل ─────────────────────────────────────────
 *
 * كل الصفحات كانت بتجيب كل الآراء، وصفحة «بداية الرحلة» بتفلترها
 * بالبحث عن كلمة «ولي» في صفة صاحب الرأي. يعني رأي ولي أمر عن قصة
 * مخصّصة كان بيظهر في قسم الجلسات، وتغيير الصفة لـ«أب» كان بيخفيه.
 *
 * دلوقتي القسم بيتحدد صراحةً من لوحة الإدارة.
 */
export const getTestimonials = async (line?: TestimonialLine): Promise<Testimonial[]> => {
  const supabase = createPublicClient();
  const query = supabase
    .from('testimonials')
    .select('id, author_name, author_role, content, line')
    .order('created_at', { ascending: false });

  if (line) query.eq('line', line);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((t) => ({
    id: t.id,
    authorName: t.author_name,
    authorRole: t.author_role,
    content: t.content,
    line: (t.line ?? 'general') as TestimonialLine,
  }));
};
