import React from 'react';
import { formatPrice } from '@/lib/utils';
import type { OrderLine } from '@/lib/order-lines';

/**
 * بنود طلب «إنها لك»: المنتج، ولمين، ونوع النسخة، والإضافات بأسعارها.
 * نفس المكوّن في قايمة الإدارة وصفحة الطلب وصفحة «طلباتي» عند العميل.
 *
 * `compact` = سطر لكل بند والإضافات في سطر تحته (للجداول).
 */
export function OrderLinesList({
  lines,
  compact = false,
  showPrices = !compact,
}: {
  lines: OrderLine[];
  compact?: boolean;
  showPrices?: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <ul className={compact ? 'space-y-1.5' : 'divide-y divide-slate-100'}>
      {lines.map((l, i) => (
        <li key={i} className={compact ? 'text-sm' : 'py-3 first:pt-0 last:pb-0'}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-bold text-slate-800">
              {l.name}
              {l.quantity > 1 && <span className="text-slate-600"> × {l.quantity.toLocaleString('ar-EG')}</span>}
              {l.childName && <span className="font-medium text-slate-600"> — لـ{l.childName}</span>}
            </span>
            {showPrices && (
              <span className="font-bold text-slate-800">{formatPrice(l.unitPrice * l.quantity)}</span>
            )}
          </div>

          {(l.formatLabel || (showPrices && l.addons.length > 0)) && (
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-medium text-slate-600">
              {l.formatLabel && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 font-bold text-violet-800">{l.formatLabel}</span>
              )}
              {showPrices && l.addons.length > 0 && <span>المنتج نفسه: {formatPrice(l.basePrice)}</span>}
            </div>
          )}

          {l.addons.length > 0 && (
            <ul className={`mt-1 ${compact ? 'text-xs text-slate-600' : 'space-y-0.5 text-sm text-slate-700'}`}>
              {compact ? (
                <li>+ {l.addons.map((a) => a.name).join('، ')}</li>
              ) : (
                l.addons.map((a, j) => (
                  <li key={j} className="flex justify-between gap-3">
                    <span>
                      + {a.name}
                      {a.customized && <span className="text-slate-500"> (بالتخصيص)</span>}
                    </span>
                    {showPrices && a.price != null && <span>{formatPrice(a.price)}</span>}
                  </li>
                ))
              )}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
