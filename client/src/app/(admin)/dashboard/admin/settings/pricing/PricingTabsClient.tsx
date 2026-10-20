'use client';

import React, { useState } from 'react';
import type { PricingFormulaSettings } from '@/types';
import { updatePricingFormulaSettings } from '@/actions/instructors';
import { updatePublisherPricingSettings, updateProviderPricingSettings } from '@/actions/finance';
import { PricingFormulaEditor, type SaveFormula } from './PricingFormulaEditor';
import { PaymentSettingsClient } from './PaymentSettingsClient';
import { FormError } from '@/components/ui/FormError';
import type { PaymentSettingsPayload } from './types';

export type PricingTabKey = 'sessions' | 'providers' | 'publishers' | 'payments';

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
  payments,
}: {
  /** تبويبات المعادلات اللي الإداري ده مسموح له بيها. */
  tabs: { key: Exclude<PricingTabKey, 'payments'>; settings: PricingFormulaSettings }[];
  /** إعدادات الدفع — `null` لو مالوش صلاحية `canManagePayments`. */
  payments: PaymentSettingsPayload | null;
}) {
  const allKeys: PricingTabKey[] = [...tabs.map((t) => t.key), ...(payments ? ['payments' as const] : [])];
  const [active, setActive] = useState<PricingTabKey>(allKeys[0] ?? 'sessions');

  const LABEL: Record<PricingTabKey, string> = {
    sessions: 'جلسات الكتابة',
    providers: 'خدمات مقدّمي الخدمات',
    publishers: 'منتجات الناشرين',
    payments: 'إعدادات الدفع',
  };

  const CONFIG: Record<
    Exclude<PricingTabKey, 'payments'>,
    {
      save: SaveFormula;
      headline: string;
      formula: string;
      baseLabel: string;
      multiplierHint: string;
      examples: number[];
    }
  > = {
    sessions: {
      save: updatePricingFormulaSettings,
      headline: 'معادلة تسعير جلسات المدربين',
      formula: 'السعر النهائي للعميل = (مستحق المدرب × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'مستحق المدرب',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على مستحق المدرب.',
      examples: [100, 150, 200, 300],
    },
    providers: {
      save: updateProviderPricingSettings,
      headline: 'معادلة تسعير خدمات مقدّمي الخدمات',
      formula: 'السعر النهائي للعميل = (مستحق مقدّم الخدمة × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'مستحق مقدّم الخدمة',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على مستحق مقدّم الخدمة.',
      examples: [50, 100, 200, 500],
    },
    publishers: {
      save: updatePublisherPricingSettings,
      headline: 'معادلة تسعير منتجات الناشرين',
      formula: 'السعر النهائي للعميل = (سعر الناشر الأساسي × مضاعف المنصة) + الرسوم الثابتة',
      baseLabel: 'سعر الناشر الأساسي',
      multiplierHint: 'مثال: 1.1 يعني زيادة 10% على سعر الناشر الأساسي.',
      examples: [50, 100, 200, 500],
    },
  };

  const formula = tabs.find((t) => t.key === active);

  return (
    <div className="space-y-6">
      {allKeys.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {allKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                k === active
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {LABEL[k]}
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ `key` بيعيد بناء المحرّر مع كل تبويب — من غيره الخانات
          بتفضل شايلة أرقام التبويب اللي قبله، والإداري يحفظ معادلة
          بقيم معادلة تانية. */}
      {formula && (
        <PricingFormulaEditor key={formula.key} settings={formula.settings} {...CONFIG[formula.key]} />
      )}

      {active === 'payments' &&
        (payments?.ok ? (
          <PaymentSettingsClient
            settings={payments.settings}
            gatewayConfigured={payments.gatewayConfigured}
            walletNumber={payments.walletNumber}
            qrUrl={payments.qrUrl}
          />
        ) : (
          <FormError message={payments?.error ?? 'تعذّر قراءة إعدادات الدفع'} />
        ))}
    </div>
  );
}
