import { electronicAvailable } from '@/lib/item-format';
import { PAUSED_MESSAGE } from '@/lib/delivery';

/**
 * المنتج ده بيتطلب دلوقتي ولا لأ؟ — قرار تامر (٢٤ أكتوبر).
 *
 * «المنتجات اللي فيها توصيل بس، والتوصيل متوقف: خلّي فيه إشارة من برّه.
 *  ماتسمحلوش يروح للتخصيص وبعدين تقوله مفيش».
 *
 * المنتج «بالتوصيل بس» = مالوش نسخة إلكترونية: كتب المكتبة كلها،
 * والقصص المخصصة اللي مالهاش سعر إلكتروني.
 */
export function shipsOnly(product: { category?: string; electronicPrice?: number | null }): boolean {
  return !electronicAvailable(product);
}

/** سبب عدم الإتاحة لو فيه — `null` = متاح. */
export function productUnavailableReason(
  product: { category?: string; electronicPrice?: number | null },
  pause: { paused: boolean; message: string },
): string | null {
  if (!pause.paused || !shipsOnly(product)) return null;
  return pause.message.trim() || PAUSED_MESSAGE.replace(' — يمكنك طلب النسخة الإلكترونية', '');
}
