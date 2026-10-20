import React from 'react';
import { formatPrice } from '@/lib/utils';

/**
 * ملخّص فلوس الطلب: المنتجات ← خصم الكود ← الشحن ← الإجمالي.
 *
 * ⚠️ **الإجمالي من القاعدة** (`total_amount`) — هو اللي اتطلب تحويله.
 *    المنتجات والخصم والشحن للتوضيح، ولو مجموعهم مش مساوي الإجمالي
 *    (طلب قديم قبل ما الأعمدة دي تتسجّل) بنعرض الإجمالي بس من غير تفصيل.
 */
export function OrderTotals({
  subtotal,
  discountCode,
  discountAmount = 0,
  shippingFee,
  total,
}: {
  subtotal: number;
  discountCode?: string;
  discountAmount?: number;
  shippingFee?: number;
  total: number;
}) {
  const shipping = shippingFee ?? 0;
  const consistent = Math.abs(subtotal - discountAmount + shipping - total) < 1;
  return (
    <dl className="ms-auto w-full max-w-sm space-y-1.5 text-sm">
      {consistent && (
        <>
          <div className="flex justify-between text-slate-600">
            <dt>المنتجات</dt>
            <dd className="font-bold">{formatPrice(subtotal)}</dd>
          </div>
          {discountCode && (
            <div className="flex justify-between font-bold text-emerald-800">
              <dt>
                كود الخصم <span dir="ltr" className="font-mono">{discountCode}</span>
              </dt>
              <dd>− {formatPrice(discountAmount)}</dd>
            </div>
          )}
          {shipping > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>الشحن</dt>
              <dd className="font-bold">{formatPrice(shipping)}</dd>
            </div>
          )}
        </>
      )}
      {!consistent && discountCode && (
        <div className="flex justify-between font-bold text-emerald-800">
          <dt>
            كود الخصم <span dir="ltr" className="font-mono">{discountCode}</span>
          </dt>
          <dd>− {formatPrice(discountAmount)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-black text-slate-900">
        <dt>الإجمالي</dt>
        <dd>{formatPrice(total)}</dd>
      </div>
    </dl>
  );
}
