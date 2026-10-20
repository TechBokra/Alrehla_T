import { createClient } from '@/lib/supabase/server';

/** كود خصم في شاشة الإدارة — ومعاه عدد استخداماته وإجمالي الخصم. */
export type DiscountCodeRow = {
  id: string;
  code: string;
  percent: number;
  lines: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  used: number;
  totalDiscount: number;
};

/**
 * كل الأكواد — للإدارة. `null` = ملف القاعدة 13 لسه ماتشغّلش.
 * (قواعد الحماية بتقصر القراءة على الإدارة.)
 */
export async function getDiscountCodes(): Promise<DiscountCodeRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code !== '42P01') console.error('getDiscountCodes', error);
    return null;
  }

  const { data: uses } = await supabase.from('discount_code_uses').select('code_id, discount_amount');
  const stats = new Map<string, { used: number; total: number }>();
  for (const u of uses ?? []) {
    const s = stats.get(u.code_id) ?? { used: 0, total: 0 };
    s.used += 1;
    s.total += Number(u.discount_amount) || 0;
    stats.set(u.code_id, s);
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    percent: r.percent,
    lines: r.lines,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    maxUses: r.max_uses,
    isActive: r.is_active,
    note: r.note,
    createdAt: r.created_at,
    used: stats.get(r.id)?.used ?? 0,
    totalDiscount: stats.get(r.id)?.total ?? 0,
  }));
}
