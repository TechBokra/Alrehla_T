'use client';

import { useEffect } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { clearPendingOrder, loadPendingOrder } from '@/lib/pending-order-store';
import { takeDeferredItems } from '@/lib/cart-storage';

/**
 * تفضية السلة بعد الدفع بالبوابة.
 *
 * ⚠️ **ده كان ناقص خالص.** مسار التحويل كان بيفضّي السلة بعد رفع
 *    الإيصال، لكن مسار XPay بيرجع العميل على صفحة التأكيد دي — ومفيش
 *    حاجة كانت بتفضّيها. فالعميل يدفع، ويرجع يلاقي نفس البنود في السلة
 *    جاهزة تتطلب تاني.
 *
 * ⚠️ بتفضّي **بس** لو الطلب ده هو اللي اتسجّل من السلة دي (محفوظ في
 *    `pending-order-store`). كده فتح صفحة تأكيد طلب قديم من رابط
 *    مايمسحش سلة جديدة.
 */
export function ClearPaidCart({ orderId }: { orderId: string }) {
  const { clearCart, addItem } = useCart();
  useEffect(() => {
    const pending = loadPendingOrder();
    if (!pending || pending.orderId !== orderId) return;
    clearCart();
    clearPendingOrder();
    // البنود اللي استنت طلب الاشتراك ترجع للسلة — نفس مسار التحويل.
    for (const item of takeDeferredItems<CartItem>()) addItem(item);
  }, [orderId, clearCart, addItem]);
  return null;
}
