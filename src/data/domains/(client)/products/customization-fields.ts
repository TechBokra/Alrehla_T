import { type AppliesToTarget, isVisibleFor } from '@/lib/applies-to';
import type { CustomizationField } from '@/lib/customization-fields';
import { createPublicClient } from '@/lib/supabase/public';
import { mapField } from '@/data/domains/(shared)/products/customization-fields-internal';

/**
 * الخانات المفعّلة — لخطوة التخصيص عند العميل.
 *
 * `target` = المنتج اللي العميل بيخصّصه أو الصندوق — بيشيل الخانات اللي
 * الإدارة حددتها لمنتجات تانية (ملف 12). من غيره بترجع كله.
 *
 * ⚠️ **الخطأ = مفيش خانات، مش صفحة خطأ.** لو الجدول مش موجود (ملف 06 لسه
 *    ماتشغّلش) أو القاعدة وقعت لحظة، العميل يكمّل طلبه بخانات الأساس بدل
 *    ما مسار الشراء كله يقف.
 * ⚠️ و`*` مش قايمة أعمدة: لو ملف 12 لسه ماتشغّلش، تسمية `applies_to`
 *    كانت هتوقع القراءة كلها وتخفي الخانات.
 */
export async function getActiveCustomizationFields(target?: AppliesToTarget): Promise<CustomizationField[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('customization_fields')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('تعذّر قراءة خانات التخصيص', error);
    return [];
  }
  const fields = (data ?? []).map(mapField);
  return target ? fields.filter((f) => isVisibleFor(f.appliesTo, target)) : fields;
}
