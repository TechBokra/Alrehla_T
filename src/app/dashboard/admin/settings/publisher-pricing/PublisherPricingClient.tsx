'use client';

import React, { useState } from 'react';
import { PricingFormulaSettings } from '@/types';
import { Save, Info } from 'lucide-react';
import { updatePublisherPricingSettings } from '@/actions/finance';
import { calculateFinalSessionPrice } from '@/lib/utils'; // We can reuse this function as it just applies multiplier + fixed
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

export function PublisherPricingClient({ settings }: { settings: PricingFormulaSettings }) {
  const [multiplier, setMultiplier] = useState(settings.platformMultiplier);
  const [fixedFee, setFixedFee] = useState(settings.fixedAdminFee);
  
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<{ error: string; field?: string } | null>(null);

  // Example base prices for live preview
  const examples = [50, 100, 200, 500];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setIsSaved(false);
    setFailure(null);
    try {
      // ⚠️ الأكشن بقى بيرجّع النتيجة بدل ما يرمي — والرسالة بتظهر هنا
      //    (تحت الخانة لو هي السبب) بدل `alert` عامة.
      const result = await updatePublisherPricingSettings(multiplier, fixedFee);
      if (!result.ok) {
        setFailure({ error: result.error, field: result.field });
        return;
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error(error);
      setFailure({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-blue-800">
        <Info className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">معادلة التسعير لمنتجات الناشرين</p>
          <p>السعر النهائي للعميل = (سعر الناشر الأساسي × مضاعف المنصة) + الرسوم الثابتة</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="مضاعف المنصة"
            required
            hint="مثال: 1.1 يعني زيادة بنسبة 10% على سعر الناشر الأساسي لمنتجه."
            error={failure?.field === 'multiplier' ? failure.error : undefined}
          >
            <TextInput
              type="number"
              step="0.01"
              name="multiplier"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
            />
          </Field>
          <Field
            label="الرسوم الثابتة للمنصة (ج.م)"
            required
            hint="تضاف هذه الرسوم بعد تطبيق المضاعف."
            error={failure?.field === 'fixedFee' ? failure.error : undefined}
          >
            <TextInput
              type="number"
              name="fixedFee"
              value={fixedFee}
              onChange={(e) => setFixedFee(parseFloat(e.target.value))}
            />
          </Field>
        </div>

        <FormError message={failure && !failure.field ? failure.error : ''} />

        <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
          {isSaved && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <span>تم الحفظ بنجاح</span>
            </div>
          )}
          <BusyButton type="submit" busy={isSaving} pendingLabel="جاري الحفظ..." className="px-8">
            <Save className="h-5 w-5" />
            حفظ الإعدادات
          </BusyButton>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-800 mb-4">معاينة حية للأسعار</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="py-3 px-4 rounded-r-xl">سعر الناشر الأساسي</th>
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
                    <td className="py-3 px-4 font-bold text-blue-700">{finalPrice} ج.م</td>
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
