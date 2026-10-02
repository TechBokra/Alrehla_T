import { createClient } from '@/lib/supabase/server';
import type { AdminPermission } from '@/types';

/**
 * Everything waiting for an admin decision, counted in one place.
 *
 * The admin dashboard showed totals (orders, bookings, instructors) but never
 * said what actually needed attention, so a payment proof or a join request
 * could sit for days unless somebody opened that screen by chance.
 *
 * Every count is a `head: true` count — no rows are transferred, just numbers.
 */

export type ReviewQueueItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  /** The admin permission needed to act on it. */
  permission: AdminPermission;
  /** Money, or a customer left waiting — shown first. */
  urgent: boolean;
};

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };

  const [
    paymentProofs,
    servicePaymentProofs,
    joinRequests,
    profileRequests,
    serviceOffers,
    openTickets,
    sessionRequests,
    withdrawals,
    stalledOrders,
  ] = await Promise.all([
    supabase.from('orders').select('id', head).eq('status', 'awaiting_verification'),
    supabase.from('service_orders').select('id', head).eq('status', 'awaiting_verification'),
    supabase.from('join_requests').select('id', head).eq('status', 'pending'),
    supabase.from('profile_update_requests').select('id', head).eq('status', 'pending'),
    // "قيد المراجعة" plus an approved offer whose instructor has asked for a
    // different price — the second kind is invisible in the status alone.
    // من `provider_services` — الجدول اللي البيع بيمر منه. كان بيعدّ من
    // `instructor_services`، فالعدّاد كان بيقول للإدارة إن فيه طلبات
    // مستنية مراجعة، والمراجعة نفسها بتحصل على جدول تاني.
    supabase
      .from('provider_services')
      .select('id, status, requested_price, approved_price')
      .or('status.eq.pending,and(status.eq.approved,requested_price.not.is.null)'),
    supabase.from('support_tickets').select('id', head).eq('status', 'open'),
    supabase.from('support_session_requests').select('id', head).eq('status', 'pending'),
    supabase.from('withdrawal_requests').select('id', head).eq('status', 'pending'),
    // Delivered more than 7 days ago and still unconfirmed by the customer.
    // No scheduled job: the cutoff is computed when this page is opened.
    supabase
      .from('service_orders')
      .select('id', head)
      .eq('status', 'delivered')
      .lt('delivered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // A count the current admin is not allowed to read comes back as an error or
  // null; it is treated as nothing to review rather than breaking the page.
  const n = (result: { count: number | null }) => result.count ?? 0;

  const pendingOffers = (serviceOffers.data ?? []).filter(
    (o) => o.status === 'pending' || o.requested_price !== o.approved_price
  ).length;

  const items: ReviewQueueItem[] = [
    {
      key: 'payment_proofs',
      label: 'طلبات بانتظار تأكيد الدفع',
      count: n(paymentProofs),
      href: '/dashboard/admin/orders',
      permission: 'canManageOrders',
      urgent: true,
    },
    {
      key: 'service_payment_proofs',
      label: 'طلبات خدمات بانتظار تأكيد الدفع',
      count: n(servicePaymentProofs),
      href: '/dashboard/admin/orders/services',
      permission: 'canManageOrders',
      urgent: true,
    },
    {
      key: 'withdrawals',
      label: 'طلبات سحب أرباح',
      count: n(withdrawals),
      href: '/dashboard/admin/finance/withdrawals',
      permission: 'canManageFinance',
      urgent: true,
    },
    {
      key: 'stalled_orders',
      label: 'طلبات سلّمت ولم يؤكدها العميل',
      count: n(stalledOrders),
      href: '/dashboard/admin/orders/services',
      permission: 'canManageOrders',
      urgent: true,
    },
    {
      key: 'tickets',
      label: 'تذاكر دعم مفتوحة',
      count: n(openTickets),
      href: '/dashboard/admin/support/tickets',
      permission: 'canManageSupport',
      urgent: true,
    },
    {
      key: 'session_requests',
      label: 'طلبات جلسات دعم',
      count: n(sessionRequests),
      href: '/dashboard/admin/support/session-requests',
      permission: 'canManageSupport',
      urgent: false,
    },
    {
      key: 'join_requests',
      label: 'طلبات انضمام',
      count: n(joinRequests),
      href: '/dashboard/admin/join-requests',
      permission: 'canManageSupport',
      urgent: false,
    },
    {
      key: 'profile_requests',
      label: 'طلبات تعديل ملفات المدربين',
      count: n(profileRequests),
      href: '/dashboard/admin/instructors',
      permission: 'canManageInstructors',
      urgent: false,
    },
    {
      key: 'service_offers',
      label: 'طلبات مدربين لتقديم خدمات',
      count: pendingOffers,
      href: '/dashboard/admin/instructors',
      permission: 'canManageInstructors',
      urgent: false,
    },
  ];

  return items.filter((i) => i.count > 0);
}
