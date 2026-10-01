import type { BoxShipment, BoxSubscription } from '@/types';
import type { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase/server';

type SubRow = Database['public']['Tables']['box_subscriptions']['Row'];
type ShipRow = Database['public']['Tables']['box_shipments']['Row'];

const SHIP_STATUSES: BoxShipment['status'][] = ['pending', 'preparing', 'shipped', 'delivered'];

function mapShipment(r: ShipRow): BoxShipment {
  return {
    id: r.id,
    monthNumber: r.month_number,
    goal: r.goal ?? undefined,
    status: (SHIP_STATUSES as string[]).includes(r.status) ? (r.status as BoxShipment['status']) : 'pending',
    trackingReference: r.tracking_reference ?? undefined,
    shippedAt: r.shipped_at ?? undefined,
    deliveredAt: r.delivered_at ?? undefined,
  };
}

function mapSubscription(sub: SubRow, shipments?: ShipRow[]): BoxSubscription {
  return {
    id: sub.id,
    userId: sub.user_id ?? undefined,
    customerName: sub.customer_name,
    planName: sub.plan_name,
    status: sub.status,
    // ⚠️ كانت `|| new Date()` — اشتراك من غير موعد كان بيتعرض «النهارده».
    nextShipmentDate: sub.next_shipment_date ?? '',
    orderId: sub.order_id ?? undefined,
    months: sub.months ?? undefined,
    startsAt: sub.starts_at ?? undefined,
    endsAt: sub.ends_at ?? undefined,
    addonDiscountPercent: sub.addon_discount_percent ?? 0,
    freeAddonName: sub.free_addon_name ?? undefined,
    details: (sub.details as Record<string, unknown> | null) ?? undefined,
    shipments: shipments
      ?.filter((s) => s.subscription_id === sub.id)
      .sort((a, b) => a.month_number - b.month_number)
      .map(mapShipment),
  };
}

async function withShipments(subs: SubRow[]): Promise<BoxSubscription[]> {
  if (subs.length === 0) return [];
  const supabase = await createClient();
  const { data: ships } = await supabase
    .from('box_shipments')
    .select('*')
    .in('subscription_id', subs.map((s) => s.id));
  return subs.map((s) => mapSubscription(s, ships ?? []));
}

/** كل الاشتراكات — للإدارة (الصلاحيات هي اللي بتقصر القراءة). */
export const getBoxSubscriptions = async (): Promise<BoxSubscription[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('box_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return withShipments(data);
};

export const getBoxSubscription = async (id: string): Promise<BoxSubscription | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('box_subscriptions').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [sub] = await withShipments([data]);
  return sub ?? null;
};

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
