import { createClient } from '@/lib/supabase/server';
import type { WritingDialect } from '@/lib/writing-style';

/**
 * اللهجات المتاحة للاختيار في «إنها لك». فشل القراءة بيرجّع قايمة فاضية —
 * والمعالج وقتها بيخفي خيار «لهجة» (والقاعدة بترفضه لو اتبعت) بدل ما يكسر
 * مسار الشراء.
 */
export async function getActiveWritingDialects(): Promise<WritingDialect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('writing_dialects')
    .select('code, name_ar')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('تعذّر تحميل اللهجات', error);
    return [];
  }
  return (data ?? []).map((d) => ({ code: d.code, nameAr: d.name_ar }));
}
