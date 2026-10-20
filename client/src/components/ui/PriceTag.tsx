'use client';

import React, { useSyncExternalStore } from 'react';
import { formatPrice } from '@/lib/utils';
import { savingsPercent } from '@/lib/promotions';

/**
 * السعر مع العرض: السعر الجديد + الأصلي بخط عليه + شارة التوفير + تاريخ الانتهاء.
 *
 * ⚠️ للعرض فقط — السعر الحقيقي بتحسبه القاعدة وقت الطلب.
 * ⚠️ الصفحات العامة متخزّنة لحد ساعة، فالعرض اللي انتهى ممكن يكون لسه في
 *    الصفحة. المكوّن بيقارن وقت الانتهاء بساعة المتصفح ويرجع للسعر الأصلي
 *    من غير ما يستنى تحديث الصفحة.
 */
const TICK_MS = 30_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

// برّه المكوّن عن قصد: قراءة الساعة أثناء الرسم ممنوعة (react-hooks/purity)،
// والمتصفح بيقراها هنا كمصدر خارجي عبر useSyncExternalStore.
function getClientTick(): number {
  return Math.floor(Date.now() / TICK_MS);
}
function getServerTick(): number {
  return 0;
}

/** 0 على الخادم وقت أول رسم (نفس مخرجات الخادم)، وبعدها رقم الفترة الحالية. */
function useClockTick(): number {
  return useSyncExternalStore(subscribe, getClientTick, getServerTick);
}

const END_FORMAT = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Africa/Cairo',
});

export function PriceTag({
  price,
  listPrice,
  endsAt,
  label,
  className = '',
  showEnds = true,
  showBadge = true,
}: {
  price: number;
  /** السعر الأصلي — موجود فقط لو فيه عرض. */
  listPrice?: number;
  endsAt?: string;
  label?: string;
  /** مقاس/لون الرقم الأساسي. */
  className?: string;
  showEnds?: boolean;
  showBadge?: boolean;
}) {
  const tick = useClockTick();
  const endMs = endsAt ? Date.parse(endsAt) : Number.NaN;
  // دقّة نص دقيقة كفاية لانتهاء عرض.
  const ended = tick > 0 && Number.isFinite(endMs) && tick * TICK_MS >= endMs;
  const onSale = listPrice !== undefined && listPrice > price && !ended;

  if (ended && listPrice !== undefined) {
    return <span className={className}>{formatPrice(listPrice)}</span>;
  }
  if (!onSale) return <span className={className}>{formatPrice(price)}</span>;

  const pct = savingsPercent(listPrice, price);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={className}>{formatPrice(price)}</span>
      <del className="text-sm font-medium text-slate-500" aria-label={`السعر قبل العرض ${formatPrice(listPrice)}`}>
        {formatPrice(listPrice)}
      </del>
      {showBadge && (
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800">
          {label || (pct > 0 ? `خصم ${pct.toLocaleString('ar-EG')}٪` : 'عرض')}
        </span>
      )}
      {showEnds && Number.isFinite(endMs) && (
        <span className="basis-full text-xs font-medium text-slate-600">
          العرض ينتهي {END_FORMAT.format(new Date(endMs))}
        </span>
      )}
    </span>
  );
}
