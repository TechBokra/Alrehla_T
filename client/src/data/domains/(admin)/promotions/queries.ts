import { createClient } from '@/lib/supabase/server';
import type { Promotion, PromotionTarget } from '@/lib/promotions';
import { mapPromotionRow } from '@/data/domains/(shared)/promotions/live';

export type PromotionTargetOption = { id: string; name: string; price: number; isActive: boolean };

export type AdminPromotions = {
  promotions: Promotion[];
  targets: Record<PromotionTarget, PromotionTargetOption[]>;
};

export type AdminPromotionsResult =
  | ({ ok: true } & AdminPromotions)
  | { ok: false; error: string };

/**
 * كل العروض (السارية والقادمة والمنتهية والموقوفة) + اللي ينفع يتعمل عليه عرض.
 * فشل القراءة = خطأ صريح لا قايمة فاضية (قاعدة الأدمن الصارمة).
 */
export async function getAdminPromotions(): Promise<AdminPromotionsResult> {
  const supabase = await createClient();
  const [promos, products, addons, plans] = await Promise.all([
    supabase
      .from('price_promotions')
      .select('id, target_type, target_id, kind, value, label, starts_at, ends_at, is_active')
      .order('ends_at', { ascending: false }),
    supabase.from('personalized_products').select('id, name, price, electronic_price, is_active').order('name'),
    supabase.from('addon_products').select('id, name, price, is_active').order('name'),
    supabase.from('box_subscription_plans').select('id, name, price_total, is_active').order('sort_order'),
  ]);

  const failed = promos.error ?? products.error ?? addons.error ?? plans.error;
  if (failed) {
    console.error('Error loading promotions', failed);
    return { ok: false, error: 'تعذّر تحميل العروض. حدّث الصفحة وحاول مرة أخرى.' };
  }

  return {
    ok: true,
    promotions: (promos.data ?? []).flatMap((r) => {
      const p = mapPromotionRow(r);
      return p ? [p] : [];
    }),
    targets: {
      product_printed: (products.data ?? []).map((p) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price),
        isActive: p.is_active ?? true,
      })),
      product_electronic: (products.data ?? [])
        .filter((p) => (p.electronic_price ?? 0) > 0)
        .map((p) => ({
          id: String(p.id),
          name: p.name,
          price: Number(p.electronic_price),
          isActive: p.is_active ?? true,
        })),
      addon: (addons.data ?? []).map((a) => ({
        id: String(a.id),
        name: a.name,
        price: Number(a.price),
        isActive: a.is_active ?? true,
      })),
      box_plan: (plans.data ?? []).map((b) => ({
        id: String(b.id),
        name: b.name,
        price: Number(b.price_total),
        isActive: b.is_active ?? true,
      })),
    },
  };
}
