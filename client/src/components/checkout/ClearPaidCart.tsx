'use client';

import { useEffect, useRef } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { clearPendingOrder, loadPendingOrder, paidItemIds } from '@/lib/pending-order-store';
import { takeDeferredItems } from '@/lib/cart-storage';

/**
 * صفحة «شكرًا» بعد البوابة: بنود الطلب ده بتتشال من السلة **على طول**،
 * من غير ما نستنى تأكيد الدفع يوصل (الرجوع من البوابة ممكن يسبقه بثواني).
 *
 * ⚠️ **بيستنى `ready`.** النسخة الأولى كانت بتفضّي قبل ما السلة تتقري
 *    من المتصفح، والسلة بعدها بتتقري وترجع كاملة (ALR-000068-QB).
 *
 * ⚠️ بس لو الطلب ده هو اللي اتسجّل من السلة دي — رابط تأكيد طلب
 *    قديم مايمسحش سلة جديدة.
 */
export function ClearPaidCart({ orderId }: { orderId: string }) {
  const { ready, items, removeItems, addItem } = useCart();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const pending = loadPendingOrder();
    if (!pending || pending.orderId !== orderId) return;
    removeItems(paidItemIds(pending, items));
    clearPendingOrder();
    for (const item of takeDeferredItems<CartItem>()) addItem(item);
  }, [ready, orderId, items, removeItems, addItem]);
  return null;
}
