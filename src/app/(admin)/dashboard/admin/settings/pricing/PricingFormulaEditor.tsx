'use client';

import React, { useState } from 'react';
import { Save, Info } from 'lucide-react';
import type { PricingFormulaSettings } from '@/types';
import { calculateFinalSessionPrice } from '@/lib/utils';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * ⚠️ **الأكشنات التلاتة بتسمّي نفس الخانة باسمين مختلفين:** معادلة
 *    الجلسات بترجّع `platformMultiplier`/`fixedAdminFee`، والتانيتين
 *    بيرجّعوا `multiplier`/`fixedFee`. النوع بياخد الاتنين، والمحرّر
 *    بيقارن بالاسمين — من غير كده رسالة الخطأ كانت هتظهر تحت الخانة
 *    الغلط (أو ماتظهرش خالص).
 */
export type FormulaField = 'multiplier' | 'fixedFee' | 'platformMultiplier' | 'fixedAdminFee';

export type SaveFormula = (
  multiplier: number,
  fixedFee: number,
) => Promise<{ ok: true } | { ok: false; error: string; field?: FormulaField }>;

const IS_MULTIPLIER = (f?: string) => f === 'multiplier' || f === 'platformMultiplier';
const IS_FEE = (f?: string) => f === 'fixedFee' || f === 'fixedAdminFee';

/**
 * محرّر معادلة تسعير واحدة.
 *
 * ⚠️ **كان مكتوب تلات مرات** — واحد لكل معادلة، بنفس الخانات ونفس
 *    المعاينة ونفس الفحوص. وده مش تكرار شكلي: اتنين منهم كانوا بيعملوا
 *    `upsert` والتالت `update` مجرّد، فصف مش موجود كان بيتحفظ «بنجاح»
 *    من غير ما يتكتب. نسخة واحدة معناها إن أي إصلاح بيحصل للتلاتة.
 *
 * ⚠️ **والمعاينة الحية بتحسب من القيم اللي في الخانات دلوقتي**، لا من
 *    المحفوظ — عشان الإداري يشوف أثر رقمه قبل ما يحفظ، مش بعده.
 */
export function PricingFormulaEditor({
  settings,
  save,
  headline,
  formula,
  baseLabel,
  multiplierHint,
  examples,
}: {
  settings: PricingFormulaSettings;
  save: SaveFormula;
  headline: string;
  formula: string;
  baseLabel: string;
  multiplierHint: string;
  examples: number[];
}) {
  const [multiplier, setMultiplier] = useState(settings.platformMultiplier);
  const [fixedFee, setFixedFee] = useState(settings.fixedAdminFee);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: string; field?: FormulaField } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setFailure(null);
    try {
      const result = await save(multiplier, fixedFee);
      if (!result.ok) {
        setFailure({ error: result.error, field: result.field });
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setFailure({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <Info className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">{headline}</p>
          <p>{formula}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="مضاعف المنصة"
            required
            hint={multiplierHint}
            error={IS_MULTIPLIER(failure?.field) ? failure?.error : undefined}
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
            hint="تُضاف بعد تطبيق المضاعف."
            error={IS_FEE(failure?.field) ? failure?.error : undefined}
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

        <div className="flex justify-end gap-4 border-t border-slate-100 pt-4">
          {saved && <span className="font-bold text-emerald-600">تم الحفظ بنجاح</span>}
          <BusyButton type="submit" busy={busy} pendingLabel="جاري الحفظ..." className="px-8">
            <Save className="h-5 w-5" />
            حفظ الإعدادات
          </BusyButton>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-black text-slate-800">معاينة حية للأسعار</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="rounded-r-xl px-4 py-3">{baseLabel}</th>
                <th className="px-4 py-3">السعر النهائي للعميل</th>
                <th className="rounded-l-xl px-4 py-3">ربح المنصة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examples.map((base) => {
                const final = calculateFinalSessionPrice(base, {
                  platformMultiplier: multiplier,
                  fixedAdminFee: fixedFee,
                });
                return (
                  <tr key={base}>
                    <td className="px-4 py-3 font-bold text-slate-800">{base} ج.م</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{final} ج.م</td>
                    <td className="px-4 py-3 text-slate-600">{final - base} ج.م</td>
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
