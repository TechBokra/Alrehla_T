import { SubscriptionTier } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { applyBoxPlanPromotions } from '@/lib/promotions';
import { getLivePromotions } from '@/data/domains/(shared)/promotions/live';

export const getSubscriptionTiers = async (
  options: { includeInactive?: boolean } = {},
): Promise<SubscriptionTier[]> => {
  // الإدارة بتحتاج تشوف الخطط المقفولة عشان تعدّلها، والزائر لأ.
  // القراءة العامة بلا كوكيز عشان صفحة الاشتراك تفضل مخزّنة مسبقًا.
  const supabase = options.includeInactive
    ? await createClient()
    : createPublicClient();

  const query = supabase
    .from('box_subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('duration_months', { ascending: true });

  if (!options.includeInactive) query.eq('is_active', true);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return [];
  }

  const tiers: SubscriptionTier[] = data.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceTotal: plan.price_total,
    priceMonthly: plan.price_monthly,
    durationMonths: plan.duration_months,
    savingsNote: plan.savings_note ?? undefined,
    imageUrl: plan.image_url ?? undefined,
    description: plan.description ?? undefined,
    features: plan.features ?? [],
    isHighlighted: plan.is_highlighted ?? false,
    isActive: plan.is_active ?? true,
    sortOrder: plan.sort_order ?? 0,
    addonDiscountPercent: plan.addon_discount_percent ?? 0,
    freeAddonId: plan.free_addon_id ?? undefined,
  }));

  // الإدارة (includeInactive) بتشوف الأسعار الأصلية؛ الزائر بيشوف بعد العرض.
  if (options.includeInactive) return tiers;
  const promotions = await getLivePromotions();
  const now = new Date();
  return tiers.map((t) => applyBoxPlanPromotions(t, promotions, now));
};
