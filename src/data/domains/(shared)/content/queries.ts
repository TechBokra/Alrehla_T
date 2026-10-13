import { cache } from 'react';
import { type SiteContent, CONTENT_DEFAULTS } from '@/lib/site-content';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * نصوص الصفحات.
 *
 * بتُقرأ مرة واحدة لكل عرض للصفحة (React.cache بيمنع تكرار الاستعلام لو
 * أكتر من مكوّن في نفس الصفحة طلبها)، وبترجع النص الأصلي من الكود لأي
 * مفتاح الإدارة ما عدّلتوش — فالصفحة عمرها ما بتفضى لو الجدول فاضي أو
 * لو الاتصال بقاعدة البيانات وقع.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('page_content').select('key, value');

  if (error || !data) {
    if (error) console.error('Error fetching page content:', error);
    return { ...CONTENT_DEFAULTS };
  }

  const overrides: Record<string, string> = {};
  for (const row of data) {
    // نص فاضي في قاعدة البيانات مش تعديل — بنرجّع الأصلي.
    if (typeof row.value === 'string' && row.value.trim() !== '') {
      overrides[row.key] = row.value;
    }
  }

  return { ...CONTENT_DEFAULTS, ...overrides };
});
