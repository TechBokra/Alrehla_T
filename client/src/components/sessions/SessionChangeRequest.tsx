'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { requestSessionChange } from '@/actions/session-change-requests';
import { useAction } from '@/lib/use-action';
import { Field, TextInput, TextArea, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { RESCHEDULE_NOTICE_HOURS, RESCHEDULE_POLICY_TEXT } from '@/lib/reschedule-policy';

type Existing = {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  proposedAt: string;
  adminNote: string | null;
} | null;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'full', timeStyle: 'short' });

/**
 * «اطلب تغيير الموعد» — لولي الأمر والمدرب والطالب (ملف 16 — #LQMO).
 *
 * الموعد المقترح بيتكتب بساعة القاهرة (`datetime-local` من غير منطقة
 * زمنية — والخادم بيقراه كده). الإدارة هي اللي بتوافق وتغيّر.
 */
export function SessionChangeRequest({
  sessionId,
  existing,
  scheduledAt,
}: {
  sessionId: string;
  existing: Existing;
  /** موعد الجلسة الحالي — لو أقل من ٢٤ ساعة الزرار بيتشال (بند ٦). */
  scheduledAt?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proposedAt, setProposedAt] = useState('');
  const [reason, setReason] = useState('');
  const send = useAction(requestSessionChange, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    fallbackError: 'تعذّر إرسال الطلب — جرّب تاني',
  });
  const fieldError = (f: string) => (send.errorField === f ? send.error : undefined);

  if (existing?.status === 'pending') {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        طلبت تغيير الموعد لـ {fmt(existing.proposedAt)} — مستني الإدارة.
      </p>
    );
  }

  // ⚠️ نفس شرط الخادم (`rescheduleAllowed`)، عشان الشاشة ماتعرضش
  //    نموذج هيترفض. الخادم هو الحارس — ده للعرض بس.
  // eslint-disable-next-line react-hooks/purity -- مقارنة بالوقت الحالي للعرض فقط
  const tooLate = scheduledAt ? new Date(scheduledAt).getTime() - Date.now() < RESCHEDULE_NOTICE_HOURS * 3_600_000 : false;
  if (tooLate) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
        فاضل أقل من {RESCHEDULE_NOTICE_HOURS} ساعة على الجلسة، فتغيير الموعد مش متاح من هنا. لو فيه ظرف طارئ،
        كلّم الإدارة من الدعم.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">{RESCHEDULE_POLICY_TEXT}</p>
      {existing?.status === 'rejected' && existing.adminNote && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
          آخر طلب تغيير اترفض: {existing.adminNote}
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-slate-500"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          اطلب تغيير الموعد
        </button>
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            send.run({ sessionId, proposedAt, reason });
          }}
        >
          <Field label="الموعد اللي يناسبك (بتوقيت القاهرة)" required error={fieldError('proposedAt')}>
            <TextInput type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} />
          </Field>
          <Field label="السبب" required error={fieldError('reason')}>
            <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {!send.errorField && <FormError message={send.error} />}
          <div className="flex gap-2">
            <BusyButton type="submit" busy={send.pending} pendingLabel="جارٍ الإرسال…">
              ابعت الطلب للإدارة
            </BusyButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 text-sm font-bold text-slate-600 hover:text-slate-900"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
