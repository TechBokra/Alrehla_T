'use client';

import { useEffect, useRef } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { clearPendingOrder, loadPendingOrder, paidItemIds } from '@/lib/pending-order-store';
import { takeDeferredItems } from '@/lib/cart-storage';
import { getOrderPaymentState } from '@/actions/payments';

/**
 * بنود اتدفعت بتتشال من السلة — في **أي صفحة** العميل يفتحها.
 *
 * ⚠️ **ليه مش صفحة «شكرًا» بس؟** طلب ALR-000068-QB (٢٤ أكتوبر) اتدفع
 *    والسلة فضلت مليانة. صفحة الرجوع من البوابة ممكن ماتتفتحش أصلًا
 *    (العميل قفل التاب، أو البوابة رجّعته على صفحة تانية). فالمكوّن
 *    ده جوّه كل الصفحات: أول ما السلة تتقري، لو فيه طلب محفوظ بيسأل
 *    الخادم عن حالته، ولو اتدفع بيشيل بنوده.
 *
 * ⚠️ بيستنى `ready` — قبله السلة لسه ماتقرتش، والتعديل بيضيع.
 */
export function PaidCartSweeper() {
  const { ready, items, removeItems, addItem } = useCart();
  const checked = useRef(false);

  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    const pending = loadPendingOrder();
    if (!pending) return;
    void getOrderPaymentState(pending.orderId).then((state) => {
      if (state === 'placed') {
        removeItems(paidItemIds(pending, items));
        clearPendingOrder();
        // البنود اللي استنت طلب الاشتراك ترجع للسلة.
        for (const item of takeDeferredItems<CartItem>()) addItem(item);
      } else if (state === 'closed') {
        clearPendingOrder();
      }
    });
  }, [ready, items, removeItems, addItem]);

  return null;
}
