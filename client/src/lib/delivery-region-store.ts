/**
 * منطقة التوصيل اللي العميل اختارها في المعالج — بتتحفظ عشان صفحة
 * الدفع تبدأ بيها بدل ما يختارها تاني (قرار ٢٤ أكتوبر: «يكمّل الطلب
 * مباشرة»).
 *
 * ⚠️ `localStorage` للراحة بس: لو فاضي أو مقفول، العميل بيختار في
 *    الدفع عادي. والقاعدة (`shipping_quote`) هي اللي بتحكم في الآخر.
 */
export type DeliveryRegion = { country: string; gov: string; city: string };

const KEY = 'alrehla:delivery-region';

export function loadDeliveryRegion(): DeliveryRegion | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DeliveryRegion>;
    if (typeof v.country !== 'string' || typeof v.gov !== 'string' || typeof v.city !== 'string') return null;
    return { country: v.country, gov: v.gov, city: v.city };
  } catch {
    return null;
  }
}

export function saveDeliveryRegion(region: DeliveryRegion): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(region));
  } catch {
    // تخزين مقفول (تصفّح خاص) — الدفع هيسأل تاني، ومفيش ضرر.
  }
}
