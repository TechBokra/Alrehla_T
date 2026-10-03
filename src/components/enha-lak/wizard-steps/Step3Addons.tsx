import { formatPrice } from '@/lib/utils';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { AddonProduct } from '@/types';
import { customizedAddonIdsFor } from '@/lib/item-format';

/**
 * الإضافات بتيجي من قاعدة البيانات (جدول `addon_products`) عن طريق
 * الصفحة، مش مكتوبة هنا. قبل كده كانت تلات إضافات بأسعار في كود
 * المتصفح، وبعدين قايمة فاضية ثابتة.
 *
 * ── التخصيص (ملف 07 — قرار تامر) ───────────────────────────
 *
 * **التخصيص مش اختياري — هو هدف المشروع.** كان فيه «بتخصيص / بدون»؛
 * دلوقتي أي إضافة بتقبل التخصيص بتتخصص دايمًا بنفس اسم الطفل وصورته
 * اللي اتكتبوا للقصة أو الغلاف، وسعرها المعروض شامل التخصيص. مفيش
 * خانات جديدة يملاها العميل.
 *
 * ⚠️ الأسعار المعروضة هنا للعرض فقط. `create_customer_order` بتقرا
 *    السعر و`customization_price` من الجدول، **وبتخصّص لوحدها** أي
 *    إضافة بتقبل التخصيص — تلاعب المتصفح مبيعدّيش.
 */
export function Step3Addons({
  onNext,
  onPrev,
  addons,
}: {
  onNext: () => void;
  onPrev: () => void;
  addons: AddonProduct[];
}) {
  const { watch, setValue } = useFormContext();
  const selectedAddons: string[] = watch('selectedAddonIds') || [];

  const toggleAddon = (id: string) => {
    const next = selectedAddons.includes(id)
      ? selectedAddons.filter((a) => a !== id)
      : [...selectedAddons, id];
    setValue('selectedAddonIds', next);
    // التخصيص ماشي ورا الاختيار — مش قرار منفصل.
    setValue('customizedAddonIds', customizedAddonIdsFor(addons, next));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">إضافات مميزة (اختياري)</h2>
      <p className="text-slate-600">
        كل إضافة عليها علامة «باسم الطفل وصورته» بتتعمل مخصوص لطفلك — بنفس الاسم
        والصورة اللي كتبتهم.
      </p>

      <div className="space-y-4 mt-6">
        {addons.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
            مفيش إضافات متاحة حاليًا — كمّل عادي.
          </p>
        )}
        {addons.map((addon) => {
          const isSelected = selectedAddons.includes(addon.id);
          // السعر شامل التخصيص لأنه مش اختياري.
          const shownPrice =
            addon.price + (addon.supportsCustomization ? addon.customizationPrice : 0);

          return (
            <div
              key={addon.id}
              className={`rounded-2xl border-2 transition-colors ${isSelected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleAddon(addon.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAddon(addon.id);
                  }
                }}
                className="flex cursor-pointer items-start gap-4 p-5"
              >
                <div
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}
                >
                  {isSelected && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{addon.name}</h3>
                  {addon.description && (
                    <p className="text-sm text-slate-600 mt-1">{addon.description}</p>
                  )}
                  {addon.supportsCustomization && (
                    <p className="mt-2 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      باسم الطفل وصورته
                    </p>
                  )}
                </div>
                <div className="font-black text-emerald-700">+{formatPrice(shownPrice)}</div>
              </div>

            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl bg-slate-100 px-8 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          السابق
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white transition-colors hover:bg-blue-700"
        >
          الخطوة التالية
        </button>
      </div>
    </div>
  );
}
