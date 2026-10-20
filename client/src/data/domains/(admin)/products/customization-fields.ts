import type { CustomizationField } from '@/lib/customization-fields';
import { createClient } from '@/lib/supabase/server';
import { mapField } from '@/data/domains/(shared)/products/customization-fields-internal';

/**
 * كل الخانات (المفعّل والموقوف) — للوحة، بجلسة الإداري.
 *
 * ⚠️ هنا الخطأ **بيترمي**: فاضي في اللوحة بيتقري «مفيش خانات»، والإداري
 *    يضيفها من الأول فوق القديمة.
 */
export async function getAllCustomizationFields(): Promise<CustomizationField[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customization_fields')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('تعذّر قراءة خانات التخصيص للوحة', error);
    throw new Error('تعذّر تحميل خانات التخصيص — اتأكد إن ملف 06 اتشغّل.');
  }
  return (data ?? []).map(mapField);
}
