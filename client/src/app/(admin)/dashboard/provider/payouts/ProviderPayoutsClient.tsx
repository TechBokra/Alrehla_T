'use client';

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { WithdrawalRequestForm } from '@/components/dashboard/WithdrawalRequestForm';

/**
 * رصيد مقدّم الخدمة المستقل وزرار طلب السحب.
 *
 * النموذج نفسه **مشترك مع شاشتي المدرب والناشر** — نسخة واحدة،
 * فالإصلاح بيحصل مرة واحدة للتلاتة.
 */
export function ProviderPayoutsClient({
  availableBalance,
  hasPendingRequest,
}: {
  availableBalance: number;
  /** فيه طلب مستني المراجعة؟ القاعدة بترفض التاني، فالشاشة بتقول الأول. */
  hasPendingRequest: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 font-bold text-emerald-800">
            <Wallet className="h-5 w-5" />
            الرصيد المتاح للسحب
          </div>
          <div className="text-4xl font-black text-emerald-600">
            {formatPrice(availableBalance)}
          </div>
        </div>

        {hasPendingRequest ? (
          <p className="mt-6 rounded-xl bg-white/70 p-3 text-center text-sm font-bold text-emerald-800">
            عندك طلب سحب مستني المراجعة. هنبلّغك أول ما يتبتّ فيه.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            disabled={availableBalance <= 0}
            className="mt-6 rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
          >
            {showForm ? 'إغلاق' : 'طلب سحب'}
          </button>
        )}

        {/* الزرار بيتقفل على رصيد صفر بدل ما يفتح نموذجًا الخادم هيرفضه. */}
        {availableBalance <= 0 && !hasPendingRequest && (
          <p className="mt-3 text-center text-xs font-medium text-emerald-800">
            مفيش رصيد قابل للسحب دلوقتي. المستحق بيتسجّل لما الطلب يكتمل.
          </p>
        )}
      </div>

      {showForm && !hasPendingRequest && (
        <WithdrawalRequestForm
          availableAmount={availableBalance}
          onDone={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
