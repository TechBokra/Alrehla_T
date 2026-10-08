import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import type { CustomizationField } from '@/lib/customization-fields';
import { isMissingSchemaError, isVisibleFor, readAppliesTo, type AppliesToTarget } from '@/lib/applies-to';

type FieldRow = {
  id: string;
  label: string;
  placeholder: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  /** ملف 12 — قبله العمود مش موجود فبيوصل `undefined`. */
  applies_to?: string[] | null;
};

function mapField(r: FieldRow): CustomizationField {
  return {
    id: r.id,
    label: r.label,
    placeholder: r.placeholder || undefined,
    isRequired: Boolean(r.is_required),
    isActive: Boolean(r.is_active),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    appliesTo: readAppliesTo(r.applies_to),
  };
}

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

/**
 * عمود «يظهر فين» موجود؟ (ملف 12) — عشان اللوحة تقول «محتاجة ملف 12»
 * بدل ما الإداري يختار منتجات والحفظ يقع.
 */
export async function customizationAppliesToReady(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('customization_fields').select('applies_to').limit(1);
  if (!error) return true;
  if (!isMissingSchemaError(error)) console.error('تعذّر فحص عمود applies_to', error);
  return false;
}
