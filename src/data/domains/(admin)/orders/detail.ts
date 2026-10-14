import 'server-only';
import type { Order, OrderItem } from '@/types';
import type { QueryResult } from '@/data/query-result';
import type { Database } from '@/types/supabase';
import { isItemFormat } from '@/lib/item-format';
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

type OrderRow = Database['public']['Tables']['orders']['Row'];

type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    productId: row.product_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    customizationData:
      (row.customization_data as OrderItem['customizationData'] | null) || undefined,
    format: isItemFormat(row.format) ? row.format : 'printed',
  };
}

function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    userId: row.user_id,
    totalAmount: row.total_amount,
    status: row.status,
    transactionReference: row.transaction_reference || undefined,
    paymentReference: row.payment_reference || undefined,
    paymentMethod:
      (row.payment_method as 'instapay' | 'vodafone_cash' | null) || undefined,
    paymentReceiptUrl: row.payment_receipt_url || undefined,
    trackingReference: row.tracking_reference || undefined,
    shippedAt: row.shipped_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    adminNotes: row.admin_notes || undefined,
    shippingFee: row.shipping_fee ?? undefined,
    discountCode: row.discount_code || undefined,
    discountAmount: row.discount_amount ? Number(row.discount_amount) : undefined,
    recipientName: row.recipient_name || undefined,
    recipientPhone: row.recipient_phone || undefined,
    addressLine: row.address_line || undefined,
    city: row.city || undefined,
    governorate: row.governorate || undefined,
    countryCode: row.country_code || undefined,
    shippingNotes: row.shipping_notes || undefined,
    deliveryEmail: row.delivery_email || undefined,
    electronicSentAt: row.electronic_sent_at || undefined,
    boxPlanId: row.box_plan_id || undefined,
    boxDetails: (row.box_details as Record<string, unknown> | null) || undefined,
    createdAt: row.created_at,
    items,
  };
}

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
    return {
      success: false,
      error: {
        code: 'LOAD_FAILED',
        message: 'تعذّر تحميل تفاصيل الطلب. جرّب تاني.',
      },
    };
  }
}
