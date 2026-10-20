import type { PayoutRow } from '@/data/domains/(admin)/finance/types';
import { createClient } from '@/lib/supabase/server';

/**
 * مستحقات مقدّم الخدمة المستقل.
 *
 * ⚠️ **الشاشة دي مكانتش موجودة، ولا المستحقات نفسها.** المنصة كانت
 *    بتحصّل من العميل (مستحق المقدّم × المعامل + الرسم)، ولوحة المقدّم
 *    بتعرض عمود اسمه «مستحقك» — و`record_service_order_earning`
 *    بتقف عند `instructor_id IS NULL` فمابتسجّلش حاجة. يعني رقم
 *    معروض على الشاشة ومالوش سجل في أي مكان.
 *
 * ⚠️ **الصلاحيات في القاعدة هي الفلتر** (قاعدة «ك»): سياسة `payouts`
 *    بتحصر الصفوف على صاحبها، فمفيش فلترة بإيدنا هنا.
 */
export const getMyProviderPayouts = async (): Promise<PayoutRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payouts')
    .select('id, period, amount, status')
    .eq('owner_kind', 'provider')
    .order('created_at', { ascending: false });

  // الخطأ بيتسجّل مابيتبلعش — على شاشة فلوس، «مفيش» و«ما عرفناش»
  // مش نفس الحاجة.
  if (error) {
    console.error('Error loading provider payouts', error);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    period: p.period,
    amount: p.amount,
    status: p.status as 'pending' | 'paid',
  }));
};
