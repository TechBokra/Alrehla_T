'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';
import type { Database } from '@/types/supabase';

/**
 * متابعة شحنات صندوق الرحلة شهر بشهر (ملف 140).
 *
 * ⚠️ كل الدوال هنا بترجّع ولا بترمي (قاعدة «هـ»).
 */
type Result = { ok: true } | { ok: false; error: string };

const SHIP_LABEL: Record<string, string> = {
  preparing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
};

async function admin() {
  try {
    return await requireAdmin('canManageSubscriptions', 'غير مصرح لك بإدارة الاشتراكات');
  } catch {
    return null;
  }
}

export async function updateBoxShipment(params: {
  shipmentId: string;
  status: 'preparing' | 'shipped' | 'delivered';
  trackingReference?: string;
}): Promise<Result> {
  const me = await admin();
  if (!me) return { ok: false, error: 'غير مصرح لك بإدارة الاشتراكات' };
  if (!['preparing', 'shipped', 'delivered'].includes(params.status)) {
    return { ok: false, error: 'حالة غير معروفة' };
  }

  const now = new Date().toISOString();
  const update: Database['public']['Tables']['box_shipments']['Update'] = {
    status: params.status,
    updated_at: now,
  };
  if (params.status === 'shipped') {
    update.shipped_at = now;
    update.tracking_reference = params.trackingReference?.trim() || null;
  }
  if (params.status === 'delivered') update.delivered_at = now;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('box_shipments')
    .update(update)
    .eq('id', params.shipmentId)
    .select('subscription_id, month_number');
  if (error) {
    console.error('Error updating box shipment', error);
    return { ok: false, error: 'تعذّر التحديث — جرّب تاني' };
  }
  // قاعدة «و»: صفر صفوف بلا خطأ.
  if (!data || data.length === 0) {
    return { ok: false, error: 'مااتسجّلش — الشحنة مش موجودة أو الصلاحيات رفضت.' };
  }
  const { subscription_id, month_number } = data[0];

  const { data: sub } = await supabase
    .from('box_subscriptions')
    .select('user_id, months')
    .eq('id', subscription_id)
    .maybeSingle();

  if (params.status !== 'preparing') {
    await notifyUser({
      event: 'order_status',
      recipientProfileId: sub?.user_id,
      title: `صندوق الرحلة — الشهر ${month_number}: ${SHIP_LABEL[params.status]}`,
      message:
        params.status === 'shipped' && params.trackingReference?.trim()
          ? `رقم الشحنة: ${params.trackingReference.trim()}`
          : undefined,
      link: '/account/subscriptions/box',
    });
  }

  await logAuditAction({
    actorProfileId: me.id,
    actorName: me.fullName,
    action: `box_shipment_${params.status}`,
    entityType: 'BoxShipment',
    entityId: params.shipmentId,
    metadata: { subscriptionId: subscription_id, month: month_number },
  });

  revalidatePath(`/dashboard/admin/subscriptions/box/${subscription_id}`);
  revalidatePath('/dashboard/admin/subscriptions/box');
  revalidatePath('/account/subscriptions/box');
  return { ok: true };
}

/** إيقاف مؤقت / إلغاء / تفعيل — الإلغاء بيوقّف خصم المشترك فورًا. */
export async function setBoxSubscriptionStatus(
  subscriptionId: string,
  status: 'active' | 'paused' | 'cancelled',
): Promise<Result> {
  const me = await admin();
  if (!me) return { ok: false, error: 'غير مصرح لك بإدارة الاشتراكات' };
  if (!['active', 'paused', 'cancelled'].includes(status)) {
    return { ok: false, error: 'حالة غير معروفة' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('box_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
    .select('id');
  if (error) {
    console.error('Error updating box subscription status', error);
    return { ok: false, error: 'تعذّر التحديث — جرّب تاني' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'مااتسجّلش — الاشتراك مش موجود أو الصلاحيات رفضت.' };
  }
  await logAuditAction({
    actorProfileId: me.id,
    actorName: me.fullName,
    action: `box_subscription_${status}`,
    entityType: 'BoxSubscription',
    entityId: subscriptionId,
  });
  revalidatePath(`/dashboard/admin/subscriptions/box/${subscriptionId}`);
  revalidatePath('/dashboard/admin/subscriptions/box');
  return { ok: true };
}
