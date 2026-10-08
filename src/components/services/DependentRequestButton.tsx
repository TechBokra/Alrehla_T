'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Check } from 'lucide-react';
import { createDependentRequest } from '@/actions/dependent-requests';
import { Field, TextArea, BusyButton } from '@/components/forms/Form';

/**
 * زرار الطلب في حساب الطفل.
 *
 * الطفل ممنوع من الشراء المباشر، فالزرار العادي كان هيوديه لشاشة
 * بترفضه. بدله بيبعت طلب لولي أمره، ومعاه سطر يقول ليه عايزها —
 * والسطر ده هو اللي بيخلي ولي الأمر يقدر يقرر من غير ما يسأل.
 */
export function DependentRequestButton({
  kind,
  serviceId,
  providerId,
  packageId,
  instructorId,
  label = 'اطلب من ولي أمرك',
}: {
  kind: 'service' | 'package';
  serviceId?: string;
  providerId?: string;
  packageId?: string;
  instructorId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const send = () => {
    setError('');
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createDependentRequest>>;
      try {
        result = await createDependentRequest({
          kind,
          serviceId: serviceId ?? null,
          providerId: providerId ?? null,
          packageId: packageId ?? null,
          instructorId: instructorId ?? null,
          note,
        });
      } catch {
        setError('تعذّر إرسال الطلب — جرّب تاني');
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
      setOpen(false);
      router.refresh();
    });
  };

  if (sent) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
        <Check className="h-4 w-4" />
        الطلب راح لولي أمرك — هيرد عليك قريب.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
        >
          <Send className="h-4 w-4" /> {label}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <Field label="اكتب لولي أمرك ليه عايز ده (اختياري)" name="note">
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="مثال: عايز حد يراجع قصتي قبل ما أسلّمها"
          className="text-sm"
        />
      </Field>
      {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <BusyButton busy={isPending} pendingLabel="جاري الإرسال…" onClick={send}>
          ابعت الطلب
        </BusyButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
