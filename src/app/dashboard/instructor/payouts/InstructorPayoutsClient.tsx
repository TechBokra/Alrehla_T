'use client';
import { formatPrice } from '@/lib/utils';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';

import React, { useState } from 'react';
import { InstructorPayout } from '@/types';
import { WithdrawalRequestForm } from '@/components/dashboard/WithdrawalRequestForm';

interface Props {
  payouts: InstructorPayout[];
}

export function InstructorPayoutsClient({ payouts }: Props) {
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const pendingAmount = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-blue-800 mb-1">الرصيد القابل للسحب</h3>
            <p className="text-3xl font-black text-blue-900">{formatPrice(pendingAmount)}</p>
          </div>
          <button 
            onClick={() => setShowWithdrawForm(true)}
            disabled={pendingAmount === 0}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            طلب سحب
          </button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-bold text-slate-500 mb-1">إجمالي الأرباح المدفوعة</h3>
          <p className="text-3xl font-black text-slate-800">
            {formatPrice(payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0))}
          </p>
        </div>
      </div>

      {/* النموذج بقى مشتركًا مع شاشة الناشر — نسخة واحدة تتصلّح
          مرة واحدة. انظر `WithdrawalRequestForm`. */}
      {showWithdrawForm && (
        <WithdrawalRequestForm
          availableAmount={pendingAmount}
          onDone={() => setShowWithdrawForm(false)}
        />
      )}

      {/* Payouts Table */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">سجل المستحقات</h3>
        </div>
        {/* ⚠️ كان `<table>` خامًا بيتمرّر أفقيًّا على الموبايل.
            `SimpleDataTable` فيه عرض بطاقات جاهز — والمدرب بيفتح
            مستحقاته من تليفونه أكتر من أي شاشة تانية.

            ⚠️ والشارة كانت مرسومة محليًّا، و«قيد الانتظار» بلون
               التحذير. الانتظار مش تحذير. */}
        <SimpleDataTable
          enableSearch={false}
          emptyMessage="مفيش مستحقات لسه."
          columns={[
            { header: 'الفترة', accessorKey: 'period' },
            { header: 'المبلغ', accessorKey: 'amountDisplay' },
            { header: 'الحالة', accessorKey: 'statusDisplay' },
          ]}
          data={payouts.map((payout) => ({
            period: payout.period,
            amount: payout.amount,
            amountDisplay: (
              <span className="font-black text-blue-700">{formatPrice(payout.amount)}</span>
            ),
            statusDisplay: (
              <StatusBadge
                label={payout.status === 'paid' ? 'مدفوع' : 'قيد الانتظار'}
                type={payout.status === 'paid' ? 'success' : 'pending'}
              />
            ),
          }))}
        />
      </div>
    </div>
  );
}
