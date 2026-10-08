'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { resolveDeletionRequest } from '@/actions/account-deletion';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

type Row = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  /** الحساب لسه موجود (مش ممسوح) — عشان رابط «افتح الحساب». */
  userExists: boolean;
  /** اتأرشف (حذف حساب عليه حركات). */
  archived: boolean;
  reason: string;
  status: 'pending' | 'done' | 'rejected';
  adminNotes: string;
  createdAt: string;
};

const STATUS: Record<Row['status'], { label: string; type: StatusBadgeType }> = {
  pending: { label: 'قيد المراجعة', type: 'pending' },
  done: { label: 'اتنفّذ', type: 'success' },
  rejected: { label: 'مرفوض', type: 'neutral' },
};

export function DeletionRequestsClient({ requests }: { requests: Row[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  // الطلب الشغّال والزرار اللي اتداس — عشان «جارٍ…» تظهر على زراره هو بس.
  const [busy, setBusy] = useState<{ id: string; status: 'done' | 'rejected' } | null>(null);
  const [error, setError] = useState('');
  // الخطأ على ملاحظة طلب بعينه (رفض من غير سبب) — بيظهر تحت خانته.
  const [fieldError, setFieldError] = useState<{ id: string; message: string } | null>(null);

  const resolve = async (id: string, status: 'done' | 'rejected') => {
    setBusy({ id, status });
    setError('');
    setFieldError(null);
    let result: Awaited<ReturnType<typeof resolveDeletionRequest>>;
    try {
      result = await resolveDeletionRequest({ id, status, adminNotes: notes[id] });
    } catch {
      setError('حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.');
      return;
    } finally {
      setBusy(null);
    }

    if (!result.ok) {
      if (result.field === 'adminNotes') setFieldError({ id, message: result.error });
      else setError(result.error);
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
      <FormError message={error} />

      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">
                {r.userExists ? (
                  <Link href={`/dashboard/admin/users/${r.userId}`} className="text-blue-700 hover:underline">
                    {r.userName}
                  </Link>
                ) : (
                  r.userName
                )}
                {r.archived && (
                  <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    مؤرشف
                  </span>
                )}
              </h3>
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
              <Field
                label="ملاحظة الإدارة"
                name="adminNotes"
                hint="إلزامية عند الرفض."
                error={fieldError?.id === r.id ? fieldError.message : undefined}
              >
                <TextInput
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  placeholder="ملاحظة (إلزامية عند الرفض)"
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                {/* الحذف نفسه من صفحة الحساب: هي اللي بتعرف عليه حركات ولا لأ
                    (يتمسح ولا يتأرشف)، وبتقفل الطلب ده لوحدها. */}
                {r.userExists ? (
                  <Link
                    href={`/dashboard/admin/users/${r.userId}`}
                    className="rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
                  >
                    افتح الحساب واحذفه
                  </Link>
                ) : (
                  <BusyButton
                    busy={busy?.id === r.id && busy.status === 'done'}
                    disabled={busy?.id === r.id}
                    onClick={() => resolve(r.id, 'done')}
                  >
                    الحساب ممسوح — اقفل الطلب
                  </BusyButton>
                )}
                <BusyButton
                  variant="secondary"
                  busy={busy?.id === r.id && busy.status === 'rejected'}
                  disabled={busy?.id === r.id}
                  onClick={() => resolve(r.id, 'rejected')}
                >
                  رفض الطلب
                </BusyButton>
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
