'use client';

import React, { useId } from 'react';
import { Checkbox } from '@/components/forms/Form';
import { BOX_TARGET, type AppliesToProduct } from '@/lib/applies-to';
import { productCategoryLabel } from '@/lib/product-categories';

/**
 * «يظهر فين» — لخانات التخصيص وأهدافه (ملف 12).
 *
 * القيمة `null` = كل المنتجات والصندوق، وإلا قايمة أرقام منتجات و/أو 'box'.
 *
 * ⚠️ «منتجات بعينها» من غير ولا اختيار بيتحفظ `null` (القاعدة بتحوّل
 *    الفاضي لـNULL) — يعني «للكل»، مش «ولا حاجة». فبنقول ده تحت.
 */
export function AppliesToPicker({
  value,
  onChange,
  products,
  disabled,
  unavailable,
  showBox = true,
  allLabel = 'كل المنتجات (وصندوق الرحلة)',
}: {
  /** اختيار «صندوق الرحلة» — الإضافات مالهاش خطوة في الصندوق فبتخفيه. */
  showBox?: boolean;
  allLabel?: string;
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  products: AppliesToProduct[];
  disabled?: boolean;
  /** ملف 12 لسه ماتشغّلش — «كل المنتجات» بس. */
  unavailable?: boolean;
}) {
  const name = useId();
  const specific = value !== null;
  const selected = value ?? [];

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    onChange(next);
  };

  // تجميع بالتصنيف — «مخصص» و«مكتبة» — عشان القايمة الطويلة تتقري.
  const groups = new Map<string, AppliesToProduct[]>();
  for (const p of products) {
    const key = productCategoryLabel(p.category);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-bold text-slate-700">بيظهر فين</legend>

      {unavailable && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">
          اختيار منتجات بعينها محتاجة ملف 12 — لحد ما يتشغّل بيظهر في كل المنتجات.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700">
          <input
            type="radio"
            name={name}
            checked={!specific}
            onChange={() => onChange(null)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          {allLabel}
        </label>
        <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700">
          <input
            type="radio"
            name={name}
            checked={specific}
            disabled={unavailable}
            onChange={() => onChange([])}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          منتجات بعينها
        </label>
      </div>

      {specific && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          {showBox && (
            <Checkbox
              label="صندوق الرحلة"
              checked={selected.includes(BOX_TARGET)}
              onChange={(e) => toggle(BOX_TARGET, e.target.checked)}
            />
          )}
          {[...groups.entries()].map(([group, list]) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-bold text-slate-500">{group}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.name}
                    checked={selected.includes(p.id)}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                  />
                ))}
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-xs font-medium text-slate-500">مفيش منتجات مخصصة أو مكتبة لسه.</p>
          )}
          {selected.length === 0 && (
            <p className="text-xs font-bold text-amber-700">
              مااخترتش حاجة — لو حفظت كده هيظهر في كل المنتجات.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
