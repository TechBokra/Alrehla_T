'use client';

import React from 'react';

/**
 * اختيار الباقات اللي المدرب بيدرّبها.
 *
 * ⚠️ **الفاضي معناه «كل الباقات» — مش «ولا باقة».**
 *
 *    والمكوّن ده **بيقول كده بالنص** عن قصد. من غير السطر ده، الإداري
 *    (أو المدرب) يشوف ست مربّعات كلها فاضية ويفتكر إن المدرب مقفول
 *    على مفيش — والحقيقة العكس تمامًا.
 *
 *    والسبب في القاعدة نفسها: لو الفاضي معناه «ولا باقة»، كان كل
 *    المدربين يختفوا من الموقع أول ما الميزة تنشر.
 */
export type PackageChoice = {
  id: string;
  name: string;
  track: string | null;
  ageGroup: string;
  sessionsCount: number | null;
};

const TRACK_LABEL: Record<string, string> = {
  foundation: 'تأسيس',
  youth: 'يافعين',
  specialization: 'تخصص',
};

export function PackagePicker({
  packages,
  selected,
  onChange,
  disabled,
}: {
  packages: PackageChoice[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-3">
      {selected.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          مش محدَّد — المدرب بيظهر في <strong>كل</strong> الباقات. حدّد باقة أو أكتر
          عشان تقصره عليها.
        </p>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          بيظهر في {selected.length} باقة من {packages.length}.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {packages.map((pkg) => {
          const checked = selected.includes(pkg.id);
          return (
            <label
              key={pkg.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                checked ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
              } ${disabled ? 'opacity-60' : 'hover:border-slate-300'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(pkg.id)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-800">{pkg.name}</span>
                <span className="block text-xs font-medium text-slate-500">
                  {TRACK_LABEL[pkg.track ?? ''] ?? pkg.track ?? '—'}
                  {' · '}
                  {pkg.ageGroup === 'under_12' ? 'تحت ١٢' : '١٢ فأكتر'}
                  {pkg.sessionsCount ? ` · ${pkg.sessionsCount} جلسة` : ''}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
