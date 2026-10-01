/**
 * حفظ السلة في المتصفح — **الحساب وحده، بلا شاشة** (عشان يتختبر).
 *
 * ── ليه اتحفظت ──────────────────────────────────────────────
 *
 * السلة كانت في ذاكرة الصفحة بس: تحديث الصفحة، أو فتح الموقع في
 * تاب تاني، أو رجوع العميل بعد ساعة = **سلة فاضية**، ومعاها تخصيص
 * القصة اللي قعد يملاه (اسم الطفل وصورته واهتماماته).
 *
 * ── والتنازل اللي اتقبل عن قصد (قرار تامر، 1 أكتوبر) ─────────
 *
 * التخصيص فيه اسم الطفل ورابط صورته، والحفظ معناه إنهم يفضلوا على
 * الجهاز لحد ما الطلب يكمل. على جهاز عائلة مشترك ده تنازل بسيط عن
 * الخصوصية. فاتقفل من تلات نواحي:
 *   • **مدة صلاحية** (`MAX_AGE_MS`): السلة الأقدم من كده بتتشال لوحدها
 *   • **تسجيل الخروج بيمسحها** (`clearStoredCart`) — اللي بعدك على
 *     نفس الجهاز مايلاقيش سلّتك
 *   • **إتمام الطلب بيمسحها** (`clearCart` في السياق)
 *
 * ⚠️ **وأي قراءة بتفشل = سلة فاضية، مش خطأ.** التخزين ممكن يكون
 *    مقفول (تصفّح خاص، متصفح مانع)، أو المحفوظ من نسخة قديمة بشكل
 *    مختلف. السلة الفاضية أحسن من صفحة واقعة.
 */

export const CART_STORAGE_KEY = 'alrehla-cart-v1';

/** أسبوع — كفاية لعميل رجع يكمّل، ومش كفاية لسلة منسية شهور. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** حدث بيبلّغ السلة المفتوحة إنها تتفضّى (تسجيل الخروج). */
export const CART_CLEAR_EVENT = 'alrehla:cart-clear';

type Stored<T> = { savedAt: number; items: T[] };

/** الشكل الأدنى لسطر في السلة — اللي من غيره السطر مالوش معنى. */
function isValidLine(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.productId === 'string' &&
    typeof o.name === 'string' &&
    typeof o.price === 'number' &&
    Number.isFinite(o.price) &&
    typeof o.quantity === 'number' &&
    Number.isInteger(o.quantity) &&
    o.quantity > 0
  );
}

export function serializeCart<T>(items: T[], now: number): string {
  const payload: Stored<T> = { savedAt: now, items };
  return JSON.stringify(payload);
}

/**
 * قراءة المحفوظ.
 *
 * ⚠️ **السطر التالف بيتشال لوحده، مش السلة كلها**: نسخة قديمة من
 *    الموقع ممكن تكون حفظت سطرًا بشكل مختلف — مفيش داعي يضيّع باقي
 *    السلة بسببه.
 *
 * ⚠️ **والسعر هنا للعرض بس.** الخادم بيسعّر من القاعدة وقت الطلب
 *    (قاعدة «ف») — فسعر معدّل باليد في التخزين مايدفعش أقل.
 */
export function parseStoredCart<T>(raw: string | null, now: number): T[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<Stored<unknown>>;
    if (!data || typeof data.savedAt !== 'number' || !Array.isArray(data.items)) return [];
    if (now - data.savedAt > MAX_AGE_MS || data.savedAt > now + 60_000) return [];
    return data.items.filter(isValidLine) as T[];
  } catch {
    return [];
  }
}

/** بتتنادى قبل تسجيل الخروج: بتمسح المحفوظ وبتفضّي السلة المفتوحة. */
export function clearStoredCart(): void {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.localStorage.removeItem(DEFERRED_STORAGE_KEY);
  } catch {
    // التخزين مقفول — مفيش حاجة محفوظة أصلًا.
  }
  try {
    window.dispatchEvent(new Event(CART_CLEAR_EVENT));
  } catch {
    // برّه المتصفح.
  }
}

/**
 * منتجات «مستنية» — اتشالت من السلة عشان اشتراك الصندوق يتطلب لوحده،
 * وبترجع للسلة أول ما طلب الاشتراك يخلص (`CheckoutClient`).
 *
 * ⚠️ بنفس صلاحية السلة (أسبوع) وبتتمسح مع الخروج (`clearStoredCart`).
 */
export const DEFERRED_STORAGE_KEY = 'alrehla-cart-deferred-v1';

export function saveDeferredItems<T>(items: T[]): void {
  try {
    window.localStorage.setItem(DEFERRED_STORAGE_KEY, serializeCart(items, Date.now()));
  } catch {
    /* المتصفح مانع التخزين — المنتجات بتضيع زي الحذف العادي */
  }
}

export function takeDeferredItems<T>(): T[] {
  try {
    const items = parseStoredCart<T>(window.localStorage.getItem(DEFERRED_STORAGE_KEY), Date.now());
    window.localStorage.removeItem(DEFERRED_STORAGE_KEY);
    return items;
  } catch {
    return [];
  }
}
