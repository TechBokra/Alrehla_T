import type { Order, OrderItem } from '@/types';
import type { Database } from '@/types/supabase';
import { isItemFormat } from '@/lib/item-format';

/**
 * صف الطلب ← `Order` — من مكان واحد.
 *
 * ⚠️ كان فيه **تلات نسخ** من التحويل ده (قايمة الإدارة، وتفاصيل الطلب، وطلبات
 *    العميل) — واتفرّقوا: قايمة الإدارة ماكانش فيها بيانات بوابة الدفع
 *    (تنظيف ٣ نوفمبر).
 */
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'product_id' | 'quantity' | 'unit_price' | 'customization_data' | 'format'
>;

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    productId: row.product_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    customizationData: (row.customization_data as OrderItem['customizationData'] | null) || undefined,
    format: isItemFormat(row.format) ? row.format : 'printed',
  };
}

export function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    userId: row.user_id,
    totalAmount: row.total_amount,
    status: row.status,
    transactionReference: row.transaction_reference || undefined,
    paymentReference: row.payment_reference || undefined,
    paymentMethod: (row.payment_method as 'instapay' | 'vodafone_cash' | null) || undefined,
    paymentReceiptUrl: row.payment_receipt_url || undefined,
    paymentProvider: row.payment_provider ?? null,
    paidAt: row.paid_at ?? null,
    paymentIntentId: row.payment_intent_id ?? null,
    trackingReference: row.tracking_reference || undefined,
    shippedAt: row.shipped_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    adminNotes: row.admin_notes || undefined,
    shippingFee: row.shipping_fee ?? undefined,
    // ملف 13 — قبله العمود مش موجود فبيرجع undefined.
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
