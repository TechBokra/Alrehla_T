'use client';

import React, { useState } from 'react';
import { PricingFormulaSettings } from '@/types';
import { Save, Info } from 'lucide-react';
import { updatePricingFormulaSettings } from '@/actions/instructors';
import { calculateFinalSessionPrice } from '@/lib/utils';
import { useAction } from '@/lib/use-action';
import { FormError } from '@/components/ui/FormError';

export function PricingSettingsClient({ settings }: { settings: PricingFormulaSettings }) {
  const [multiplier, setMultiplier] = useState(settings.platformMultiplier);
  const [fixedFee, setFixedFee] = useState(settings.fixedAdminFee);
  const [isSaved, setIsSaved] = useState(false);

  // Example base prices for live preview
  const examples = [100, 150, 200, 300];

  /**
   * ⚠️ دي شاشة **بتحدد سعر كل جلسة على الموقع**، وكانت أخطر واحدة في
   *    الفئة دي: `await` عارية بلا `try`. والأكشن بيرمي لو الصلاحية
   *    ناقصة — فـ`setIsSaving(false)` مبتتنفّذش والزر بيتقفل على
   *    «جاري الحفظ...» للأبد، والإعدادات زي ما هي.
   *
   *    وأسوأ احتمال: الحفظ يقع والإداري يفتكره تم، فيبني تسعيره على
   *    أرقام مش موجودة في القاعدة.
   */
  const save = useAction(updatePricingFormulaSettings, {
    onSuccess: () => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    fallbackError: 'تعذّر حفظ إعدادات التسعير.',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(false);
    await save.run(multiplier, fixedFee);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-blue-800">
        <Info className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">معادلة التسعير</p>
          <p>السعر النهائي للعميل = (سعر المدرب الأساسي × مضاعف المنصة) + الرسوم الثابتة</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">مضاعف المنصة</label>
            <input 
              type="number" 
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500">مثال: 1.2 يعني زيادة بنسبة 20% على سعر المدرب الأساسي.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">الرسوم الإدارية الثابتة (ج.م)</label>
            <input 
              type="number" 
              value={fixedFee}
              onChange={(e) => setFixedFee(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500">تضاف هذه الرسوم بعد تطبيق المضاعف.</p>
          </div>
        </div>

        <FormError message={save.error} />

        <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
          {isSaved && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <span>تم الحفظ بنجاح</span>
            </div>
          )}
          <button
            type="submit"
            disabled={save.pending}
            aria-busy={save.pending || undefined}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {save.pending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-800 mb-4">معاينة حية للأسعار</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="py-3 px-4 rounded-r-xl">سعر المدرب الأساسي</th>
                <th className="py-3 px-4">السعر النهائي للعميل</th>
                <th className="py-3 px-4 rounded-l-xl">ربح المنصة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examples.map(base => {
                const currentFormula = { platformMultiplier: multiplier, fixedAdminFee: fixedFee };
                const finalPrice = calculateFinalSessionPrice(base, currentFormula);
                const platformProfit = finalPrice - base;
                return (
                  <tr key={base}>
                    <td className="py-3 px-4 font-bold text-slate-800">{base} ج.م</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{finalPrice} ج.م</td>
                    <td className="py-3 px-4 text-slate-600">{platformProfit} ج.م</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
