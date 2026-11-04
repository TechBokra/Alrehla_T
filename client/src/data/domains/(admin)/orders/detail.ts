import 'server-only';
import type { Order } from '@/types';
import type { QueryResult } from '@/data/query-result';
import { mapOrder, mapOrderItem } from '@/data/domains/(shared)/orders/map';
import { createClient } from '@/lib/supabase/server';

export type AdminOrderDetail = {
  order: Order;
  customerName: string | null;
  productNames: Record<string, string>;
  boxSubscriptionId: string | undefined;
};

export type AdminOrderDetailResult = QueryResult<
  AdminOrderDetail,
  'NOT_FOUND' | 'LOAD_FAILED'
>;

/**
 * Loads only the records needed by the admin order detail page.
 * The page checks the admin permission first; Supabase RLS also restricts
 * these session-client reads to admins.
 */
export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetailResult> {
  try {
    const supabase = await createClient();
    const { data: row, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!row) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'الطلب غير موجود.' },
      };
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, unit_price, customization_data, created_at, publisher_id_snapshot, publisher_cost_snapshot, format')
      .eq('order_id', row.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (itemsError) throw itemsError;

    const items = (itemRows ?? []).map(mapOrderItem);
    const productIds = Array.from(new Set(items.map((item) => item.productId)));

    const [customerResult, productsResult, subscriptionResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', row.user_id)
        .maybeSingle(),
      productIds.length > 0
        ? supabase
            .from('personalized_products')
            .select('id, name')
            .in('id', productIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      row.box_plan_id
        ? supabase
            .from('box_subscriptions')
            .select('id')
            .eq('order_id', row.id)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null, error: null }),
    ]);

    const relationError =
      customerResult.error ?? productsResult.error ?? subscriptionResult.error;
    if (relationError) throw relationError;

    const productNames = Object.fromEntries(
      (productsResult.data ?? []).map((product) => [product.id, product.name]),
    );

    return {
      success: true,
      data: {
        order: mapOrder(row, items),
        customerName: customerResult.data?.full_name ?? null,
        productNames,
        boxSubscriptionId: subscriptionResult.data?.id,
      },
    };
  } catch (error) {
    console.error('Failed to load admin order detail:', error);
    // ⚠️ **سبب الفشل بيتقال**: الشاشة دي للإدارة وحدها، والرسالة العامة
    //    «جرّب تاني» كانت بتخلّي طلبًا مكسورًا واحدًا لغزًا — الإداري
    //    بيعيد المحاولة عشرين مرة ومفيش حاجة بتتغيّر، ومفيش طريقة يعرف
    //    بيها إيه الناقص ولا يبلّغ بيه.
    const detail =
      (error as { message?: unknown } | null)?.message ??
      (typeof error === 'string' ? error : '');
    return {
      success: false,
      error: {
        code: 'LOAD_FAILED',
        message: detail
          ? `تعذّر تحميل تفاصيل الطلب: ${String(detail)}`
          : 'تعذّر تحميل تفاصيل الطلب. جرّب تاني.',
      },
    };
  }
}
