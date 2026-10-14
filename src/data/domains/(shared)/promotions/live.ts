import { createPublicClient } from '@/lib/supabase/public';
import type { Promotion } from '@/lib/promotions';
import { isPromotionTarget } from '@/lib/promotions';

/** صف `price_promotions` ← شكل الكود. القيمة الغريبة بتتجاهل بدل ما تكسر الصفحة. */
export function mapPromotionRow(r: {
  id: string;
  target_type: string;
  target_id: string;
  kind: string;
  value: number;
  label: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}): Promotion | null {
  if (!isPromotionTarget(r.target_type)) return null;
  if (r.kind !== 'percent' && r.kind !== 'sale_price') return null;
  return {
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    kind: r.kind,
    value: Number(r.value),
    label: r.label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isActive: r.is_active,
  };
}

/**
 * العروض السارية دلوقتي — **للصفحات العامة وحدها** (عرض الأسعار فقط).
 *
 * بتقرا بعميل الزائر (الصفحات بتتخزّن)، والفلترة «ساري الآن» في **سياسة
 * القاعدة** مش هنا. فشل القراءة = من غير عروض (السعر الأصلي) ومش كسر للصفحة:
 * السعر اللي بيتدفع بيتحسب في القاعدة أصلًا، فالعرض هنا للعرض بس.
 *
 * ⚠️ الإدارة والناشر مابيمرّوش من هنا — لازم يشوفوا السعر الأصلي.
 */
export async function getLivePromotions(): Promise<Promotion[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('price_promotions')
    .select('id, target_type, target_id, kind, value, label, starts_at, ends_at, is_active')
    .eq('is_active', true);
  if (error) {
    console.error('تعذّر تحميل العروض', error);
    return [];
  }
  return (data ?? []).flatMap((r) => {
    const p = mapPromotionRow(r);
    return p ? [p] : [];
  });
}
