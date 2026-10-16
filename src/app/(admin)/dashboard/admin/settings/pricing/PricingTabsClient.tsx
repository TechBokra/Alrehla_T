'use client';

import React, { useState } from 'react';
import type { PricingFormulaSettings } from '@/types';
import { updatePricingFormulaSettings } from '@/actions/instructors';
import { updatePublisherPricingSettings, updateProviderPricingSettings } from '@/actions/finance';
import { PricingFormulaEditor, type SaveFormula } from './PricingFormulaEditor';

export type PricingTabKey = 'sessions' | 'providers' | 'publishers';

/**
 * معادلات التسعير التلاتة في مكان واحد.
 *
 * ⚠️ **كانوا تلات شاشات في تلات تبويبات.** ومعادلات بتتقارن ببعضها
 *    بطبيعتها — الإداري بيقرر هامش الخدمة وهو شايف هامش الجلسة. تلات
 *    صفحات منفصلة كانت بتخلّي المقارنة دي ذاكرة، مش شاشة.
 *
 * ⚠️ **وكل تبويب بصلاحيته.** اللي معاه صلاحية الناشرين وبس مايشوفش
 *    تبويب الجلسات — التجميع شكلي، مش توسيع صلاحية.
 */
export function PricingTabsClient({
  tabs,
}: {
  tabs: { key: PricingTabKey; settings: PricingFormulaSettings }[];
}) {
  const [active, setActive] = useState<PricingTabKey>(tabs[0]?.key ?? 'sessions');

  const CONFIG: Record<
    PricingTabKey,
    {
      label: string;
      save: SaveFormula;
      headline: string;
      formula: string;
      baseLabel: string;
      multiplierHint: string;
      examples: number[];
    }
  > = {
    sessions: {
      label: 'جلسات الكتابة',
      save: updatePricingFormulaSettings,
      headline: 'معادلة تسعير جلسات المدربين',
      formula: 'السعر النهائي للعميل = (مستحق المدرب × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'مستحق المدرب',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على مستحق المدرب.',
      examples: [100, 150, 200, 300],
    },
    providers: {
      label: 'خدمات مقدّمي الخدمات',
      save: updateProviderPricingSettings,
      headline: 'معادلة تسعير خدمات مقدّمي الخدمات',
      formula: 'السعر النهائي للعميل = (مستحق مقدّم الخدمة × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'مستحق مقدّم الخدمة',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على مستحق مقدّم الخدمة.',
      examples: [50, 100, 200, 500],
    },
    publishers: {
      label: 'منتجات الناشرين',
      save: updatePublisherPricingSettings,
      headline: 'معادلة تسعير منتجات الناشرين',
      formula: 'السعر النهائي للعميل = (سعر الناشر الأساسي × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'سعر الناشر الأساسي',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على سعر الناشر الأساسي.',
      examples: [50, 100, 200, 500],
    },
  };

  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;
  const cfg = CONFIG[current.key];

  return (
    <div className="space-y-6">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                t.key === current.key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {CONFIG[t.key].label}
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ `key` بيعيد بناء المحرّر مع كل تبويب — من غيره الخانات
          بتفضل شايلة أرقام التبويب اللي قبله، والإداري يحفظ معادلة
          بقيم معادلة تانية. */}
      <PricingFormulaEditor key={current.key} settings={current.settings} {...cfg} />
    </div>
  );
}
