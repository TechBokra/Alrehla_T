/**
 * آخر طلب اتسجّل من صفحة الدفع ولسه مادفعش — قرار تامر (٢٤ أكتوبر):
 * «لو رجع من صفحة الدفع من غير ما يدفع، يكمّل على نفس الطلب لو اختار».
 *
 * ⚠️ للراحة بس (`localStorage`): لو فاضي أو مقفول، العميل بيعمل طلب
 *    جديد زي الأول. والخادم هو اللي بيقول الطلب لسه مستني دفع ولا لأ.
 *
 * ⚠️ **البصمة = محتوى السلة كله.** لو العميل غيّر أي حاجة (شال بند،
 *    عدّل إضافة)، الطلب المسجّل مابقاش هو اللي في السلة — فمانعرضش
 *    نكمّل عليه.
 */
export type PendingOrder = {
  orderId: string;
  reference: string;
  total: number | null;
  signature: string;
  at: number;
};

const KEY = 'alrehla:pending-order';
/** بعد يوم، الطلب القديم مابيتعرضش — الأسعار والعروض ممكن تكون اتغيّرت. */
export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export function cartSignature(items: unknown[]): string {
  return JSON.stringify(items);
}

export function savePendingOrder(p: Omit<PendingOrder, 'at'>, now = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...p, at: now }));
  } catch {
    // تخزين مقفول — مفيش استكمال، ومفيش ضرر.
  }
}

export function loadPendingOrder(): PendingOrder | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingOrder>;
    if (typeof v.orderId !== 'string' || typeof v.signature !== 'string' || typeof v.at !== 'number') return null;
    return {
      orderId: v.orderId,
      reference: typeof v.reference === 'string' ? v.reference : '',
      total: typeof v.total === 'number' ? v.total : null,
      signature: v.signature,
      at: v.at,
    };
  } catch {
    return null;
  }
}

export function clearPendingOrder(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // مفيش.
  }
}

/** الطلب المحفوظ ينفع يتعرض للاستكمال مع السلة دي؟ (من غير سؤال الخادم.) */
export function resumableFor(
  pending: PendingOrder | null,
  items: unknown[],
  now = Date.now(),
): PendingOrder | null {
  if (!pending || items.length === 0) return null;
  if (now - pending.at > PENDING_ORDER_TTL_MS) return null;
  if (pending.signature !== cartSignature(items)) return null;
  return pending;
}
