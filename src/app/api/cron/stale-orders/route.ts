import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { getSiteSettings } from '@/data/domains/content';
import { cancelStalePendingOrders, cancelledMessage } from '@/lib/stale-orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * المهمة اليومية: إلغاء الطلبات اللي مااتدفعتش (`@/lib/stale-orders`).
 *
 * نفس حراسة `service-due`: من غير `CRON_SECRET` المهمة **بتقف** (مش
 * بتعدّي) — الحارس اللي بيفشل مفتوحًا هو اللي فتح المسار ده قبل كده.
 *
 * ⚠️ لو المفتاح مش متظبط، الإلغاء بيحصل برضه لما الإدارة تفتح صفحة
 *    الطلبات (`dashboard/admin/orders`) — فمابيقفش، بس بيتأخر.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('stale-orders cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isAdminApiConfigured()) {
    return NextResponse.json({ skipped: 'SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم' }, { status: 200 });
  }

  const { pendingOrderCancelDays: days } = await getSiteSettings();
  const supabase = createAdminClient();
  const result = await cancelStalePendingOrders(supabase, days);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // الإشعارات مباشرة في الجدول — زي `service-due` (المهمة مالهاش مُرسِل،
  // و`notify_user` بترفض الاستدعاء بلا مستخدم).
  if (result.cancelled.length > 0) {
    const rows = result.cancelled.map((o) => ({
      recipient_profile_id: o.userId,
      ...cancelledMessage(o, days),
      link: '/account/orders/enha-lak',
    }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('stale-orders: notifications failed', error);
  }

  return NextResponse.json({ days, cancelled: result.cancelled.length });
}
