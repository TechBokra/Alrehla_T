'use client';
import { useFormContext } from 'react-hook-form';
import { BookOpen, Mail, Layers } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { PersonalizedProduct } from '@/types';
import {
  basePriceForFormat,
  electronicAvailable,
  FORMAT_LABELS,
  ITEM_FORMATS,
  type ItemFormat,
} from '@/lib/item-format';

const ICONS = { printed: BookOpen, electronic: Mail, both: Layers } as const;
const HINTS: Record<ItemFormat, string> = {
  printed: 'كتاب مطبوع بيتشحن لعنوانك',
  electronic: 'ملف بيوصلك على الإيميل — من غير شحن',
  both: 'الكتاب المطبوع + الملف على الإيميل',
};

/**
 * اختيار النسخة (ملف 138) — بيظهر بس لو المنتج ليه سعر إلكتروني.
 * ⚠️ الأسعار هنا للعرض؛ القاعدة بتسعّر من الجدول.
 */
export function FormatChooser({ product }: { product: PersonalizedProduct }) {
  const { watch, setValue } = useFormContext();
  if (!electronicAvailable(product)) return null;
  const current: ItemFormat = watch('format') ?? 'printed';

  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-6">
      <legend className="px-2 font-bold text-slate-800">نوع النسخة</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {ITEM_FORMATS.map((f) => {
          const Icon = ICONS[f];
          const selected = current === f;
          return (
            <label
              key={f}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-4 transition-colors ${
                selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="format-choice"
                value={f}
                checked={selected}
                onChange={() => setValue('format', f, { shouldDirty: true })}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-bold text-slate-900">
                <Icon className="h-4 w-4" aria-hidden /> {FORMAT_LABELS[f]}
              </span>
              <span className="text-xs text-slate-600">{HINTS[f]}</span>
              <span className="mt-1 font-black text-emerald-800">
                {formatPrice(basePriceForFormat(product, f))}
              </span>
            </label>
          );
        })}
      </div>
      {current !== 'printed' && (
        <p className="mt-3 text-xs text-slate-600">
          النسخة الإلكترونية نسخة واحدة — الإيميل بتكتبه في خطوة الدفع.
        </p>
      )}
    </fieldset>
  );
}
