import { signOut } from '@/actions/auth';
import { clearStoredCart } from '@/lib/cart-storage';

/**
 * الخروج من أي زرار — حاجة واحدة بتتعمل بنفس الطريقة في كل مكان.
 *
 * ⚠️ **تحميل كامل للرئيسية (`location.assign`) مش تنقّل داخلي.** التنقّل
 *    الداخلي بيحتفظ بالصفحات المخزّنة في المتصفح — فممكن تفضل بيانات
 *    الحساب ظاهرة بعد الخروج، أو الزرار يفضل يلف لو التحويل ما حصلش
 *    (ملاحظة تامر: «تسجيل الخروج بيعلق»).
 * ⚠️ ولو الخادم ما ردّش، بنكمّل برضه بعد ٦ ثواني — الزرار مايعلّقش.
 */
export async function logout(): Promise<void> {
  // السلة المحفوظة فيها اسم الطفل وصورته — اللي بعدك على نفس الجهاز
  // مايشوفهاش (`lib/cart-storage.ts`).
  clearStoredCart();
  // الجلسة في المتصفح بتتمسح الأول — من غير ما نستنى الخادم.
  try {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut({ scope: 'local' });
  } catch {
    // بنكمّل — الخادم بيمسح الكوكيز كمان.
  }
  try {
    await Promise.race([signOut(), new Promise((r) => setTimeout(r, 6000))]);
  } catch {
    // الكوكيز بتتمسح في الخادم؛ لو النداء نفسه وقع، التحميل الكامل
    // بيبيّن الحالة الحقيقية.
  }
  window.location.assign('/');
}
