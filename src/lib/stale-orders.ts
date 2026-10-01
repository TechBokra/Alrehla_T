import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * إلغاء الطلبات اللي اتسجّلت ومااتدفعتش (قرار تامر: ٧ أيام، وخانة في
 * الإعدادات).
 *
 * ── ليه ─────────────────────────────────────────────────────
 *
 * الطلب بيتسجّل **قبل** الإيصال (عشان الرقم المرجعي). فكل عميل قفل
 * الصفحة بين الخطوتين بيسيب طلبًا «بانتظار الدفع» للأبد، وقايمة
 * الإدارة بتتملا طلبات ميتة.
 *
 * ── الشرط ───────────────────────────────────────────────────
 *
 *   `pending` **و** مفيش إيصال **و** أقدم من المدة.
 *   ⚠️ «مفيش إيصال» حارس زيادة: الحالة بتبقى `awaiting_verification`
 *      أول ما الإيصال يترفع، بس لو حصل عطل وفضلت `pending` بإيصال،
 *      مانلغيش طلبًا العميل دفعه.
 */

export const DEFAULT_PENDING_CANCEL_DAYS = 7;
export const MAX_PENDING_CANCEL_DAYS = 60;

/** فاضي/مش رقم = الافتراضي · صفر = مقفول · من ١ لـ٦٠. */
export function normalizeCancelDays(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PENDING_CANCEL_DAYS;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PENDING_CANCEL_DAYS;
  return Math.min(n, MAX_PENDING_CANCEL_DAYS);
}

/** الطلبات الأقدم من اللحظة دي بتتلغي. `null` = الإلغاء مقفول. */
export function staleCutoff(now: Date, days: number): Date | null {
  if (days <= 0) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export type CancelledOrder = { id: string; userId: string; reference: string | null };

/**
 * بيلغي ويرجّع اللي اتلغى (عشان الإشعارات). بيشتغل بمفتاح الخدمة (المهمة
 * اليومية) أو بجلسة إداري (صفحة الطلبات) — الاتنين بيعدّوا من حارس
 * `guard_order_fields`.
 */
export async function cancelStalePendingOrders(
  supabase: SupabaseClient<Database>,
  days: number,
  now = new Date(),
): Promise<{ ok: true; cancelled: CancelledOrder[] } | { ok: false; error: string }> {
  const cutoff = staleCutoff(now, days);
  if (!cutoff) return { ok: true, cancelled: [] };

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      admin_notes: `اتلغى تلقائيًا: مفيش إيصال دفع خلال ${days} أيام.`,
      updated_at: now.toISOString(),
    })
    .eq('status', 'pending')
    .is('payment_receipt_url', null)
    .lt('created_at', cutoff.toISOString())
    .select('id, user_id, payment_reference');

  if (error) {
    console.error('Error cancelling stale orders', error);
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    cancelled: (data ?? []).map((o) => ({
      id: o.id,
      userId: o.user_id,
      reference: o.payment_reference ?? null,
    })),
  };
}

export function cancelledMessage(order: CancelledOrder, days: number): { title: string; message: string } {
  return {
    title: 'طلبك اتلغى',
    message:
      `الطلب ${order.reference ?? ''} اتلغى لأنه مااتدفعش خلال ${days} أيام. `
      + 'لو لسه عايزه، تقدر تطلبه تاني في أي وقت.',
  };
}
