import {
  WritingPackage, Instructor, PersonalizedProduct, AddonProduct, SubscriptionTier, 
  Testimonial, CreativeService, BlogPost, UserProfile, Booking, Order, 
  Publisher, InstructorPayout, PublisherPayout, SessionMessage, SessionAttachment, 
  StudyMaterial, InstructorStudent, BoxSubscription, SupportTicket, 
  JoinRequest, SupportSessionRequest, AuditLog, ServiceOrder, CourseSubscription, 
  SupportTicketMessage, FamilyMember, NotificationItem, UserRole,
  PublisherOrder, OrderItem,
  InstructorPricingOption, PricingFormulaSettings, InstructorCompensationProfile, InstructorCertification
} from '@/types';
import { cookies } from 'next/headers';

// Import from auth if needed


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
    recipientName: order.recipient_name || undefined,
    recipientPhone: order.recipient_phone || undefined,
    addressLine: order.address_line || undefined,
    city: order.city || undefined,
    governorate: order.governorate || undefined,
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


export type ShippingRate = {
  governorate: string;
  /** The city or district within it — Cairo and Shorouk are not the same trip. */
  city: string;
  fee: number;
};

/**
 * Shipping fees by governorate, set by the admin.
 *
 * Checkout used to charge a flat 50 EGP with the comment "Fixed shipping logic
 * for demo". Shipping is not flat, so the number now comes from here — and
 * when nothing is configured the customer is told the fee will be confirmed
 * rather than shown an invented one.
 */
export async function getShippingRates(): Promise<ShippingRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('governorate, city, fee')
    .eq('is_active', true)
    .order('governorate', { ascending: true })
    .order('city', { ascending: true });

  if (error || !data) return [];
  return data
    .filter((r) => Boolean(r.city))
    .map((r) => ({ governorate: r.governorate, city: r.city as string, fee: r.fee }));
}

export type ShippingRateRow = ShippingRate & {
  id: string;
  isActive: boolean;
};

/** Every area including the disabled ones — for the admin screen. */
export async function getAllShippingRates(): Promise<ShippingRateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('id, governorate, city, fee, is_active')
    .order('governorate', { ascending: true })
    .order('city', { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    governorate: r.governorate,
    city: r.city ?? '',
    fee: r.fee,
    isActive: r.is_active,
  }));
}

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
export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, product_id, quantity, unit_price, customization_data, format')
    .in('order_id', data.map((o) => o.id));

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of items ?? []) {
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
    recipientName: order.recipient_name || undefined,
    recipientPhone: order.recipient_phone || undefined,
    addressLine: order.address_line || undefined,
    city: order.city || undefined,
    governorate: order.governorate || undefined,
    shippingNotes: order.shipping_notes || undefined,
    deliveryEmail: order.delivery_email || undefined,
    electronicSentAt: order.electronic_sent_at || undefined,
    boxPlanId: order.box_plan_id || undefined,
    boxDetails: (order.box_details as Record<string, unknown> | null) || undefined,
    createdAt: order.created_at,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}
