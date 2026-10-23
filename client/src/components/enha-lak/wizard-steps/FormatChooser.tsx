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
  selectedAddonsNeedShipping,
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
export function FormatChooser({
  product,
  deliveryPaused = false,
  addons = [],
}: {
  product: PersonalizedProduct;
  /** التوصيل متوقف — النسخ اللي بتتشحن مقفولة. */
  deliveryPaused?: boolean;
  /** عشان نعرف أنهي إضافة مختارة بتتشحن فعلًا. */
  addons?: { id: string; deliveryFormat?: string }[];
}) {
  const { watch, setValue } = useFormContext();
  const selectedAddonIds: string[] = watch('selectedAddonIds') || [];
  if (!electronicAvailable(product)) return null;
  const current: ItemFormat = watch('format') ?? 'printed';

  /**
   * ⚠️ **«من غير شحن» كانت بتتقال وهي مش صحيحة.**
   *
   *    الكارت بيقول «ملف بيوصلك على الإيميل — من غير شحن» حتى لو
   *    العميل مختار بوسترًا مطبوعًا كإضافة. والبوستر بيتشحن، فالبند
   *    كله محتاج شحن (قاعدة القاعدة: «مطبوع **أو إضافة**»).
   *
   *    فالعميل بيقرا وعدًا بمفيش شحن، وبيترفض في الدفع. دلوقتي
   *    الكارت بيقول الحقيقة لما يكون فيه إضافة.
   */
  // ⚠️ **بأنواع الإضافات، مش بعددها** (قرار تامر، ٢٣ أكتوبر):
  //    الإضافة الإلكترونية مابتخلّيش البند محتاج شحن، فالجملة
  //    ماتقولش إنها بتتشحن.
  const addonsForceShipping = selectedAddonsNeedShipping(addons, selectedAddonIds);

  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-6">
      <legend className="px-2 font-bold text-slate-800">نوع النسخة</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {ITEM_FORMATS.map((f) => {
          const Icon = ICONS[f];
          const selected = current === f;
          // ⚠️ «مطبوعة» و«الاتنين» بيتشحنوا، فبيتقفلوا وقت إيقاف التوصيل.
          const blocked = deliveryPaused && f !== 'electronic';
          return (
            <label
              key={f}
              className={`flex flex-col gap-1 rounded-xl border-2 p-4 transition-colors ${
                blocked
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                  : selected
                    ? 'cursor-pointer border-emerald-600 bg-emerald-50'
                    : 'cursor-pointer border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="format-choice"
                value={f}
                checked={selected}
                disabled={blocked}
                onChange={() => setValue('format', f, { shouldDirty: true })}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-bold text-slate-900">
                <Icon className="h-4 w-4" aria-hidden /> {FORMAT_LABELS[f]}
              </span>
              <span className="text-xs text-slate-600">
                {blocked
                  ? 'غير متاح — التوصيل متوقف مؤقتًا'
                  : f === 'electronic' && addonsForceShipping
                    ? 'ملف بيوصلك على الإيميل — والإضافات بتتشحن لعنوانك'
                    : HINTS[f]}
              </span>
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
