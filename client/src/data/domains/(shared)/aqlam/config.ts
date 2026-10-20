import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { parseRpcResult } from '@/lib/aqlam/errors';
import { DEFAULT_AQLAM_CONFIG, normalizeAqlamConfig, cloneConfig, type AqlamConfig } from '@/lib/aqlam/config';

/**
 * قراءة إعدادات «أقلام الرحلة».
 *
 * ⚠️ `getAqlamConfig` بعميل بلا كوكيز (زي باقي القراءات العامة) عشان صفحات الزوار
 *    تفضل قابلة للتخزين المؤقت، و`cache()` بتقراها مرة واحدة لكل عرض صفحة.
 *    لو القراءة فشلت بنرجع الافتراضي (السلوك القديم) — القاعدة هي الحارس الفعلي،
 *    والإعدادات هنا للعرض والرسائل بس، فعطل القراءة مايوقّفش الصفحة.
 * ⚠️ الكلمات الممنوعة (`private`) ما بتتقراش هنا أبدًا — للإدارة بس (`getAqlamAdminConfig`).
 */
export const getAqlamConfig = cache(async (): Promise<AqlamConfig> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('aqlam_config').select('value').eq('id', true).maybeSingle();
  if (error) {
    console.error('Error reading aqlam config', error);
    return cloneConfig(DEFAULT_AQLAM_CONFIG);
  }
  return normalizeAqlamConfig(data?.value);
});

export type AqlamAdminConfig = {
  config: AqlamConfig;
  blockedWords: string[];
  updatedAt: string | null;
  updatedBy: string | null;
};

/** الإعداد الكامل بما فيه الكلمات الممنوعة — بصلاحية الإدارة (دالة القاعدة بتتأكد). */
export async function getAqlamAdminConfig(): Promise<AqlamAdminConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_admin_config');
  if (error) {
    console.error('aqlam_admin_config failed', error);
    throw new Error('تعذّر تحميل الإعدادات');
  }
  const out = parseRpcResult(data);
  if (!out.ok) throw new Error('غير مصرح لك بقراءة الإعدادات');
  const d = out.data as { value?: unknown; private?: unknown; updated_at?: unknown; updated_by?: unknown };
  const words = (d.private as { blockedWords?: unknown } | null)?.blockedWords;
  return {
    config: normalizeAqlamConfig(d.value),
    blockedWords: Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [],
    updatedAt: typeof d.updated_at === 'string' ? d.updated_at : null,
    updatedBy: typeof d.updated_by === 'string' ? d.updated_by : null,
  };
}

/** عدد النصوص على كل تصنيف (لعرضه جنب التصنيف في الإدارة، ولمنع حذف تصنيف مستعمل). */
export async function countPostsByCategory(keys: string[]): Promise<Record<string, number>> {
  const supabase = await createClient();
  const entries = await Promise.all(
    keys.map(async (key) => {
      const { count, error } = await supabase
        .from('aqlam_posts')
        .select('id', { count: 'exact', head: true })
        .eq('category', key);
      if (error) {
        console.error('Error counting aqlam posts by category', error);
        return [key, 0] as const;
      }
      return [key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
