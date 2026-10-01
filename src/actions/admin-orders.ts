'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { notifyUser, notifyAdmins } from '@/lib/notifications';
import type { Database } from '@/types/supabase';

/**
 * Moving a store order through fulfilment.
 *
 * Order status used to stop at "مدفوع": there was no shipped or delivered
 * state at all, and the "تحديث حالة الشحن" button had no handler. A customer
 * who paid for a printed book had no way of knowing whether it had been sent.
 */

/**
 * نتيجة تسجيل مستحقات الناشرين عند التسليم.
 *
 * ⚠️ **`null` معناها «الخطوة دي ما اتنفّذتش»** (الحالة مش «تم
 *    التسليم»)، و`failed: true` معناها **اتنفّذت ووقعت**. الفرق
 *    مهم: الشاشة بتسكت في الأولى وبتتكلم في التانية.
 */
export type PublisherEarningsResult = {
  recorded?: boolean;
  publishers?: number;
  amount?: number;
  missing_cost?: number;
  reason?: string;
  failed?: boolean;
} | null;

const FLOW: Record<string, string> = {
  preparing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireOrdersAdmin() {
  return requireAdmin('canManageOrders', 'غير مصرح لك بإدارة الطلبات');
}

export async function setOrderFulfilmentStatus(params: {
  orderId: string;
  status: 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  trackingReference?: string;
  note?: string;
}) {
  const admin = await requireOrdersAdmin();
  const { orderId, status, trackingReference, note } = params;

  if (status === 'cancelled' && !note?.trim()) {
    throw new Error('اكتب سبب الإلغاء');
  }

  const supabase = await createClient();

  const update: Database['public']['Tables']['orders']['Update'] = { status };
  if (status === 'shipped') update.shipped_at = new Date().toISOString();
  if (status === 'delivered') update.delivered_at = new Date().toISOString();
  if (trackingReference !== undefined) {
    update.tracking_reference = trackingReference.trim() || null;
  }
  if (note?.trim()) update.admin_notes = note.trim();

  const { data, error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', orderId)
    .select('user_id')
    .single();

  if (error || !data) {
    console.error('Error updating order fulfilment', error);
    throw new Error('تعذّر تحديث حالة الطلب');
  }

  // ── مستحقات الناشرين عند التسليم ──────────────────────────
  //
  // ⚠️ **بعد ما الحالة تتحفظ فعلًا، لا قبلها.** الدالة بتشترط إن
  //    الطلب `delivered` وبتقراه بنفسها من القاعدة — فلو اتنادت قبل
  //    الحفظ كانت هترفض.
  //
  // ⚠️ **وفشلها مش بيرمي.** الطلب اتسلّم فعلًا، والرمي هنا كان
  //    هيدّي الإدارة رسالة خطأ على عملية **تمّت** — وهي نفس الحفرة
  //    اللي ضيّعت مستحق المدرب في ملف 90: الإدارة تحاول تاني،
  //    الحالة بقت `delivered` خلاص، والمحاولة تترفض. فبنرجّع
  //    النتيجة والشاشة بتقولها.
  let payouts: PublisherEarningsResult = null;

  if (status === 'delivered') {
    const { data: result, error: payoutError } = await supabase.rpc(
      'record_order_publisher_earnings',
      { p_order_id: orderId },
    );

    if (payoutError) {
      console.error('Error recording publisher earnings', payoutError);
      payouts = { recorded: false, failed: true };
    } else {
      payouts = (result as PublisherEarningsResult) ?? null;
    }

    // منتج ناشر بلا نصيب مسجَّل: المستحق **ما اتحسبش**، والإدارة
    // لازم تعرف دلوقتي مش آخر الشهر.
    if (payouts && !payouts.failed && (payouts.missing_cost ?? 0) > 0) {
      await notifyAdmins({
        event: 'order_status',
        title: 'مستحق ناشر ما اتسجّلش',
        message:
          `الطلب اتسلّم، بس فيه ${payouts.missing_cost} ناشر منتجه بلا «نصيب الناشر» مسجَّل. `
          + 'اظبط النصيب من شاشة المنتجات وبعدين علّم الطلب «تم التسليم» تاني.',
        link: `/dashboard/admin/orders/${orderId}`,
      });
    }
  }

  await notifyUser({
    event: 'order_status',
    recipientProfileId: data.user_id,
    title: `طلبك: ${FLOW[status]}`,
    message:
      status === 'shipped' && trackingReference?.trim()
        ? `رقم الشحنة: ${trackingReference.trim()}`
        : note?.trim(),
    link: '/account/orders/enha-lak',
  });

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: `order_marked_${status}`,
    entityType: 'Order',
    entityId: orderId,
    metadata: { status, trackingReference: trackingReference ?? null, note: note ?? null },
  });

  revalidatePath(`/dashboard/admin/orders/${orderId}`);
  revalidatePath('/dashboard/admin/orders');
  revalidatePath('/account/orders/enha-lak');
  revalidatePath('/dashboard/publisher/payouts');
  revalidatePath('/dashboard/admin/finance/publisher-payouts');
  return { ok: true, payouts };
}

/**
 * «تم إرسال النسخة الإلكترونية» (ملف 138 — الإرسال يدوي بقرار تامر).
 *
 * ⚠️ بترجّع ولا بترمي (قاعدة «هـ»).
 * ⚠️ `.is('electronic_sent_at', null)`: ضغطة تانية مابتغيّرش الوقت
 *    الأول — والعميل مابياخدش إشعارين.
 */
export async function markElectronicSent(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    admin = await requireOrdersAdmin();
  } catch {
    return { ok: false, error: 'غير مصرح لك بإدارة الطلبات' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .update({ electronic_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('electronic_sent_at', null)
    .not('delivery_email', 'is', null)
    .select('user_id, delivery_email');

  if (error) {
    console.error('Error marking electronic copy sent', error);
    return { ok: false, error: 'تعذّر التسجيل — جرّب تاني' };
  }
  // قاعدة «و»: صفر صفوف بلا خطأ.
  if (!data || data.length === 0) {
    return { ok: false, error: 'مااتسجّلش: الطلب مالوش نسخة إلكترونية، أو متسجّل إنها اتبعتت قبل كده.' };
  }

  await notifyUser({
    event: 'order_status',
    recipientProfileId: data[0].user_id,
    title: 'النسخة الإلكترونية اتبعتت',
    message: `على ${data[0].delivery_email} — لو مالقيتهاش بص في الرسائل غير المرغوب فيها.`,
    link: '/account/orders/enha-lak',
  });

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'order_electronic_sent',
    entityType: 'Order',
    entityId: orderId,
  });

  revalidatePath(`/dashboard/admin/orders/${orderId}`);
  revalidatePath('/account/orders/enha-lak');
  return { ok: true };
}
