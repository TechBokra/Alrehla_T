'use client';

import React from 'react';
import { Checkbox } from '@/components/forms/Form';
import {
  availableStyles,
  WRITING_STYLES,
  WRITING_STYLE_HINTS,
  WRITING_STYLE_LABELS,
} from '@/lib/writing-style';

/**
 * أساليب الكتابة المتاحة للعميل في «إنها لك» — **لمنتجات «مخصص» وحدها**.
 *
 * ⚠️ الخانة بتختفي لغير «مخصص» وبتتبعت `writingStylesPresent` معاها عشان
 *    الخادم يعرف إنها اتعرضت (`onlySentFields`) — وإلا مايلمسش العمود.
 * ⚠️ كل الثلاثة معلّمين = بدون تقييد (`NULL` في القاعدة). والقاعدة بترفض
 *    الطلب بأسلوب مش متاح للمنتج، فالخانة دي مش مجرد واجهة.
 */
export function WritingStylesField({
  category,
  defaultValue,
}: {
  category: string;
  defaultValue?: string[];
}) {
  if (category !== 'custom') return null;
  const selected = availableStyles(defaultValue);
  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-slate-700">أساليب الكتابة المتاحة للعميل</legend>
      <input type="hidden" name="writingStylesPresent" value="1" />
      <div className="grid gap-3 sm:grid-cols-3">
        {WRITING_STYLES.map((s) => (
          <Checkbox
            key={s}
            name="writingStyles"
            value={s}
            defaultChecked={selected.includes(s)}
            label={WRITING_STYLE_LABELS[s]}
            hint={WRITING_STYLE_HINTS[s]}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        اللهجات نفسها (إضافة/إيقاف) من «إعدادات ← لهجات الكتابة».
      </p>
    </fieldset>
  );
}
