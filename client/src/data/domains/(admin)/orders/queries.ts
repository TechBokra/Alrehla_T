import type { QueryReadOptions } from '@/data/query-result';
import { Order, OrderItem } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { fetchAllPages, fetchIn } from '@/lib/fetch-all';
import { isItemFormat } from '@/lib/item-format';

/**
 * Every order — for the admin screens.
 *
 * The admin order pages used `getOrders`, which filters by the signed-in
 * user: an admin was shown only their OWN orders and believed that was the
 * whole list. Row-level security is what actually limits this read.
 *
 * Items are fetched in a second query rather than as a join, because the
 * generated types carry no relationship for it and a joined shape would have
 * to be cast away — which is how untyped data got into this codebase before.
 */
export async function getAllOrders(options: QueryReadOptions = {}): Promise<Order[]> {
  const supabase = await createClient();
  // ⚠️ على دفعات — Supabase بيقف عند ١٠٠٠ صف من غير رسالة (`lib/fetch-all`).
  const { data, error } = await fetchAllPages((from, to) =>
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (error) {
    if (options.throwOnError) throw error;
    return [];
  }

  const items = await fetchIn(
    data.map((o) => o.id),
    (part) =>
      supabase
        .from('order_items')
        .select('order_id, product_id, quantity, unit_price, customization_data, format')
        .in('order_id', part),
    undefined,
    options,
  );

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      customizationData: (item.customization_data as OrderItem['customizationData']) || undefined,
      format: isItemFormat(item.format) ? item.format : 'printed',
    });
    itemsByOrder.set(item.order_id, list);
  }

  return data.map((order) => ({
    id: order.id,
    userId: order.user_id,
    totalAmount: order.total_amount,
    status: order.status,
    transactionReference: order.transaction_reference || undefined,
    paymentReference: order.payment_reference || undefined,
    paymentMethod: (order.payment_method as 'instapay' | 'vodafone_cash' | null) || undefined,
    paymentReceiptUrl: order.payment_receipt_url || undefined,
    trackingReference: order.tracking_reference || undefined,
    shippedAt: order.shipped_at || undefined,
    deliveredAt: order.delivered_at || undefined,
    adminNotes: order.admin_notes || undefined,
    shippingFee: order.shipping_fee ?? undefined,
    // ملف 13 — قبله العمود مش موجود فبيرجع undefined.
    discountCode: order.discount_code || undefined,
    discountAmount: order.discount_amount ? Number(order.discount_amount) : undefined,
    recipientName: order.recipient_name || undefined,
    recipientPhone: order.recipient_phone || undefined,
    addressLine: order.address_line || undefined,
    city: order.city || undefined,
    governorate: order.governorate || undefined,
    countryCode: order.country_code || undefined,
    shippingNotes: order.shipping_notes || undefined,
    deliveryEmail: order.delivery_email || undefined,
    electronicSentAt: order.electronic_sent_at || undefined,
    boxPlanId: order.box_plan_id || undefined,
    boxDetails: (order.box_details as Record<string, unknown> | null) || undefined,
    createdAt: order.created_at,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}
