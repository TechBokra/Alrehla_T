import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import type { CustomizationField } from '@/lib/customization-fields';

type FieldRow = {
  id: string;
  label: string;
  placeholder: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};

function mapField(r: FieldRow): CustomizationField {
  return {
    id: r.id,
    label: r.label,
    placeholder: r.placeholder || undefined,
    isRequired: Boolean(r.is_required),
    isActive: Boolean(r.is_active),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
  };
}

/**
 * الخانات المفعّلة — لخطوة التخصيص عند العميل.
 *
 * ⚠️ **الخطأ = مفيش خانات، مش صفحة خطأ.** لو الجدول مش موجود (ملف 06 لسه
 *    ماتشغّلش) أو القاعدة وقعت لحظة، العميل يكمّل طلبه بخانات الأساس بدل
 *    ما مسار الشراء كله يقف.
 */
export async function getActiveCustomizationFields(): Promise<CustomizationField[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('customization_fields')
    .select('id, label, placeholder, is_required, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('تعذّر قراءة خانات التخصيص', error);
    return [];
  }
  return (data ?? []).map(mapField);
}

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
    .select('id, label, placeholder, is_required, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('تعذّر قراءة خانات التخصيص للوحة', error);
    throw new Error('تعذّر تحميل خانات التخصيص — اتأكد إن ملف 06 اتشغّل.');
  }
  return (data ?? []).map(mapField);
}
