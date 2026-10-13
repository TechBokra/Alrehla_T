import type { BoxSubscription } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { withShipments } from '@/data/domains/(shared)/subscriptions/subscriptions-internal';
import type { PendingBoxOrder } from '@/data/domains/(shared)/subscriptions/types';

/**
 * اشتراكات الداخل **هو** — بالرقم مش بالاسم.
 *
 * ⚠️ صفحة «اشتراكي» كانت بتفلتر بـ`customerName === user.fullName`:
 *    عميلين بنفس الاسم كانوا بيشوفوا اشتراكات بعض لو الصلاحيات
 *    سمحت (والإداري بيشوف الكل).
 */
export const getMyBoxSubscriptions = async (): Promise<BoxSubscription[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('box_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return withShipments(data ?? []);
};

/**
 * طلبات الصندوق اللي لسه مستنية الدفع أو تأكيده.
 *
 * ⚠️ اختبار «إنها لك» 5.8: الاشتراك نفسه بيتعمل **بعد** تأكيد الدفع،
 *    فالصفحة كانت بتقول «لا يوجد اشتراك» لعميل لسه دافع — ومفيش أي
 *    إشارة إن طلبه وصل. دلوقتي الطلب بيظهر بحالته لحد ما يتأكد.
 */
export const getMyPendingBoxOrders = async (): Promise<PendingBoxOrder[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, payment_reference, created_at, box_plan_id')
    .eq('user_id', user.id)
    .not('box_plan_id', 'is', null)
    .in('status', ['pending', 'awaiting_verification'])
    .order('created_at', { ascending: false });
  if (!orders || orders.length === 0) return [];

  const planIds = Array.from(new Set(orders.map((o) => o.box_plan_id as string)));
  const { data: plans } = await supabase
    .from('box_subscription_plans')
    .select('id, name')
    .in('id', planIds);
  const nameById = new Map((plans ?? []).map((p) => [p.id, p.name]));

  return orders.map((o) => ({
    orderId: o.id,
    planName: nameById.get(o.box_plan_id as string) ?? 'صندوق الرحلة',
    status: o.status as PendingBoxOrder['status'],
    paymentReference: o.payment_reference ?? undefined,
    createdAt: o.created_at,
  }));
};

/**
 * خصم المشترك الحالي على الإضافات — **للعرض**. القاعدة بتحسبه لوحدها
 * في `create_customer_order` (ملف 140)؛ ده عشان الرقم في المعالج
 * والسلة يطابق اللي هيتدفع.
 */
export const getMyAddonDiscount = async (): Promise<number> => {
  const subs = await getMyBoxSubscriptions();
  const now = Date.now();
  return subs
    .filter((s) => s.status === 'active' && s.endsAt && new Date(s.endsAt).getTime() > now)
    .reduce((max, s) => Math.max(max, s.addonDiscountPercent ?? 0), 0);
};
