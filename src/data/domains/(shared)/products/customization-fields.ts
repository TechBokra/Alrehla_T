import { createClient } from '@/lib/supabase/server';
import { isMissingSchemaError } from '@/lib/applies-to';

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
