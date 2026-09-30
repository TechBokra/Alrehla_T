import React from 'react';
import { AGE_BANDS } from '@/lib/age-bands';

/**
 * خانتا السنّ المناسب للمنتج — **مكوّن واحد للأربع نماذج**
 * (إضافة وتعديل، في الإدارة وعند الناشر).
 *
 * ⚠️ **مكوّن لا نسخ ولصق** عن قصد: درس ٢٠ — الخانة اللي بتتكتب
 *    يدويًّا في أربع أماكن بتتصلّح في واحد وتتنسي في التلاتة.
 *
 * ⚠️ **الخانتين `name` ثابتين** (`minAge` و`maxAge`): الخادم بيقرا
 *    `minAge` كعلامة إن النموذج فيه خانات السنّ أصلًا
 *    (`onlySentFields`). لو اتغيّر الاسم هنا، السنّ **هيتجاهل في
 *    صمت** بدل ما يتحفظ.
 *
 * ⚠️ **و`inputMode="numeric"` مش `type="number"`**: خانة الرقم في
 *    المتصفح بترفض «٦» بالأرقام العربية وبتبعتها فاضية — فالإداري
 *    يكتب السنّ ويحفظ ويلاقيه اتمسح. الخادم بيقبل الاتنين
 *    (`parseAgeInput`).
 */
export function ProductAgeFields({
  minAge,
  maxAge,
}: {
  minAge?: number | null;
  maxAge?: number | null;
}) {
  const inputClass =
    'w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-amber-500 focus:outline-none md:text-sm';

  return (
    <fieldset className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
      <legend className="px-2 text-sm font-bold text-slate-700">
        السنّ المناسب{' '}
        <span className="font-medium text-slate-500">(اختياري — بس من غيره المنتج مش هيظهر لما العميل يفلتر بالسنّ)</span>
      </legend>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">من سنّ</span>
          <input
            type="text"
            inputMode="numeric"
            name="minAge"
            defaultValue={minAge ?? ''}
            placeholder="مثلًا ٦"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">لحد سنّ</span>
          <input
            type="text"
            inputMode="numeric"
            name="maxAge"
            defaultValue={maxAge ?? ''}
            placeholder="فاضي = فأكبر"
            className={inputClass}
          />
        </label>
      </div>

      {/* الفئات قدّام الإداري وهو بيكتب — عشان يعرف الكتاب هيظهر فين. */}
      <p className="mt-3 text-xs leading-relaxed font-medium text-slate-600">
        فئات الموقع (نفس حزم «بداية الرحلة»):{' '}
        {AGE_BANDS.map((b) => b.label).join(' · ')}. الكتاب بيظهر تحت كل
        فئة بيتداخل معاها — «من ٨ لـ١١» بيظهر تحت ٦–٩ و١٠–١٢.
      </p>
    </fieldset>
  );
}
