'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { resolveDeletionRequest } from '@/actions/account-deletion';

type Row = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  status: 'pending' | 'done' | 'rejected';
  adminNotes: string;
  createdAt: string;
};

const STATUS: Record<Row['status'], { label: string; type: 'warning' | 'success' | 'neutral' }> = {
  pending: { label: 'قيد المراجعة', type: 'warning' },
  done: { label: 'تم الحذف', type: 'success' },
  rejected: { label: 'مرفوض', type: 'neutral' },
};

export function DeletionRequestsClient({ requests }: { requests: Row[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const resolve = async (id: string, status: 'done' | 'rejected') => {
    setBusy(id);
    setError('');
    const result = await resolveDeletionRequest({ id, status, adminNotes: notes[id] });
    setBusy('');

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center font-medium text-slate-500">
        مفيش طلبات حذف.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">{r.userName}</h3>
              {r.userEmail && (
                <p dir="ltr" className="text-right text-sm text-slate-500">{r.userEmail}</p>
              )}
              <p className="mt-1 text-xs font-medium text-slate-400">{r.createdAt}</p>
            </div>
            <StatusBadge type={STATUS[r.status].type} label={STATUS[r.status].label} />
          </div>

          {r.reason && (
            <p className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{r.reason}</p>
          )}

          {r.status === 'pending' ? (
            <div className="space-y-3">
              <input
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                placeholder="ملاحظة (إلزامية عند الرفض)"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => resolve(r.id, 'done')}
                  className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  اتحذف — اقفل الطلب
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => resolve(r.id, 'rejected')}
                  className="rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                >
                  رفض الطلب
                </button>
              </div>
            </div>
          ) : (
            r.adminNotes && (
              <p className="text-sm font-medium text-slate-500">ملاحظة الإدارة: {r.adminNotes}</p>
            )
          )}
        </div>
      ))}
    </div>
  );
}
