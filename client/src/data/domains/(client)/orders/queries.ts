import { Order } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { isItemFormat } from '@/lib/item-format';

export const getOrders = async (): Promise<Order[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((order: any) => ({
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
    items: (order.order_items || []).map((item: any) => ({
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      customizationData: item.customization_data || undefined,
      format: isItemFormat(item.format) ? item.format : 'printed',
    }))
  }));
};
