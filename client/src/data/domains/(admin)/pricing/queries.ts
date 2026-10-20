import { InstructorPricingOption } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getInstructorPricingOptions(): Promise<InstructorPricingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_pricing_options')
    .select('*')
    .eq('is_active', true)
    .order('base_price_per_session', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((o) => ({
    id: o.id,
    label: o.label,
    basePricePerSession: o.base_price_per_session,
    isActive: o.is_active,
  }));
}
