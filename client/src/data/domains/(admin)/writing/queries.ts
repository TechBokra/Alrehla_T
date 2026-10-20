import { createClient } from '@/lib/supabase/server';

export type AdminDialect = { code: string; nameAr: string; isActive: boolean; sortOrder: number };
export type AdminDialectsResult =
  | { ok: true; dialects: AdminDialect[] }
  | { ok: false; error: string };

/** كل اللهجات (حتى الموقوفة). فشل القراءة = خطأ صريح لا قايمة فاضية (قاعدة الأدمن). */
export async function getAdminWritingDialects(): Promise<AdminDialectsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('writing_dialects')
    .select('code, name_ar, is_active, sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('Error loading writing dialects', error);
    return { ok: false, error: 'تعذّر تحميل اللهجات. حدّث الصفحة وحاول مرة أخرى.' };
  }
  return {
    ok: true,
    dialects: (data ?? []).map((d) => ({
      code: d.code,
      nameAr: d.name_ar,
      isActive: d.is_active,
      sortOrder: d.sort_order,
    })),
  };
}
