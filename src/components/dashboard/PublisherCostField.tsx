'use client';

import React, { useState } from 'react';
import { customerPriceFromCost, type PricingFormula } from '@/lib/publisher-pricing';
import { formatPrice } from '@/lib/utils';
import { Field, fieldClass } from '@/components/forms/Form';

/**
 * خانة مبلغ بالجنيه — نفس شكل خانات النماذج و«ج.م» جوّاها على الشمال.
 *
 * ⚠️ `Field` بيدّي ابنه المباشر `id` و`name` و`required` و`aria-*` —
 *    فالمكوّن ده بيمرّرهم للـ`input` نفسه مش للغلاف، وإلا العنوان
 *    مايتربطش بالخانة ورسالة الخطأ ماتعلّمهاش.
 *
 * ⚠️ وهو في ملف عميل عن قصد: لو اتعرّف في ملف خادم وصفحة خادم حطّته
 *    جوّه `Field`، كان هيترسم على الخادم ويوصل لـ`Field` كـ`div`.
 */
export function MoneyInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="number" {...props} className={`${fieldClass} pl-12 ${className}`} />
      <span className="pointer-events-none absolute left-4 top-3 font-bold text-slate-400">ج.م</span>
    </div>
  );
}

/**
 * خانة «نصيبك من النسخة» — مع سعر العميل وهو بيتكتب.
 *
 * ── العطل اللي بتقفله ───────────────────────────────────────
 *
 * ⚠️ **شاشة الناشر كانت بتسمّي الخانة «السعر الورقي».**
 *
 *    فالناشر يكتب 200 وهو فاهم إن ده اللي المشتري هيدفعه، والموقع
 *    يخزّنه كسعر عميل — **ونصيب الناشر يبقى غير معروف تمامًا**.
 *    ولمّا ييجي وقت حساب مستحقاته، مفيش رقم يتحسب منه.
 *
 *    دلوقتي الخانة بتقول اللي هي عايزاه بالظبط، **وبتوري النتيجة
 *    وهو بيكتب**: نصيبه، وهامش المنصة، وسعر العميل النهائي. مفيش
 *    مفاجأة بعد الحفظ.
 *
 * ⚠️ **والرقم المعروض هنا عرض لا حساب معتمَد.** الخادم بيقرا
 *    المعادلة من القاعدة تاني وبيحسبها بنفسه (قاعدة «ف») — فحتى لو
 *    حد عبث بالصفحة، السعر المخزّن بيفضل صح.
 */
export function PublisherCostField({
  formula,
  defaultCost,
  label = 'نصيبك من النسخة الورقية',
}: {
  formula: PricingFormula;
  defaultCost?: number | null;
  label?: string;
}) {
  const [cost, setCost] = useState<number>(defaultCost ?? 0);

  const price = customerPriceFromCost(cost, formula);
  const margin = price > 0 ? price - Math.round(cost) : 0;

  return (
    <div className="space-y-3">
      <Field
        label={label}
        name="publisherCost"
        required
        hint="ده اللي بيوصلك عن كل نسخة تتباع. سعر العميل بيتحسب منه."
      >
        <MoneyInput
          min="1"
          value={cost || ''}
          onChange={(e) => setCost(Number(e.target.value))}
        />
      </Field>

      {cost > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-slate-600">نصيبك:</span>
            <span className="font-bold text-slate-800">{formatPrice(Math.round(cost))}</span>
          </div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-slate-600">هامش المنصة:</span>
            <span className="font-bold text-blue-700">+{formatPrice(margin)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 text-lg font-black">
            <span className="text-slate-800">سعر العميل:</span>
            <span className="text-emerald-600">{formatPrice(price)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
