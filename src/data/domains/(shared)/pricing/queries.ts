import { PricingFormulaSettings } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const getPublisherPricingSettings = async (): Promise<PricingFormulaSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pricing_formula_settings')
    .select('*')
    .eq('id', 'publisher-default')
    .single();

  if (error || !data) {
    return { id: 'publisher-default', platformMultiplier: 1, fixedAdminFee: 0, updatedAt: new Date().toISOString() };
  }

  return {
    id: data.id,
    platformMultiplier: data.platform_multiplier,
    fixedAdminFee: data.fixed_admin_fee,
    updatedAt: data.updated_at
  };
};

export const getPricingFormulaSettings = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pricing_formula_settings')
    .select('*')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    return { id: 'default', platformMultiplier: 1, fixedAdminFee: 0, updatedAt: new Date().toISOString() };
  }

  return {
    id: data.id,
    platformMultiplier: data.platform_multiplier,
    fixedAdminFee: data.fixed_admin_fee,
    updatedAt: data.updated_at
  };
};

/**
 * معادلة تسعير **مقدّمي الخدمات**.
 *
 * ⚠️ **كانت بتتقرا من `default`** — يعني نصيب المنصة من الخدمة مربوط
 *    بنصيبها من الجلسة، وتغيير واحد فيهم بيغيّر التاني من غير قصد.
 *
 * ⚠️ **والرجوع هنا لـ`default`، مش لـ(1, 0).** معامل ١ ورسم صفر
 *    معناهم «المنصة ماتاخدش حاجة» — فصف ناقص كان هيخلّي كل خدمة
 *    تتباع بسعر المقدّم بالظبط، في صمت. الرجوع لمعادلة الجلسات بيحافظ
 *    على السلوك القديم بدل ما يصفّر الهامش.
 */
export const getProviderPricingSettings = async (): Promise<PricingFormulaSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pricing_formula_settings')
    .select('*')
    .eq('id', 'provider-default')
    .maybeSingle();

  if (error) console.error('Error loading provider pricing settings', error);

  if (!data) return getPricingFormulaSettings();

  return {
    id: data.id,
    platformMultiplier: data.platform_multiplier,
    fixedAdminFee: data.fixed_admin_fee,
    updatedAt: data.updated_at,
  };
};
