'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextArea, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

export type ThreadMessage = {
  author: 'admin' | 'applicant';
  body: string;
  createdAt: string;
};

/**
 * نقاش المتقدّم مع الإدارة — بالمفتاح، بلا حساب.
 *
 * ⚠️ **الرد بيمر على `join_request_reply`** (دالة `SECURITY DEFINER`)
 *    لا على الجدول: الزائر مالوش أي صلاحية على `join_request_messages`،
 *    والدالة هي اللي بتتأكد من المفتاح وبتحط `author='applicant'`.
 *    فمفيش طريق يكتب بيها باسم الإدارة.
 *
 * ⚠️ **والرسالة بتتحط محليًّا بعد ما القاعدة تقبلها، مش قبل.** العرض
 *    المتفائل هنا معناه إن المتقدّم يشوف رسالته متبعوتة وهي مترفوضة.
 */
export function ApplicantThread({
  token,
  applicantName,
  initialMessages,
}: {
  token: string;
  applicantName: string;
  initialMessages: ThreadMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = body.trim();
    if (busy || !text) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('join_request_reply', {
        p_token: token,
        p_body: text,
      });

      if (rpcError) {
        console.error('join_request_reply', rpcError);
        setError('تعذّر إرسال الرسالة — جرّب تاني.');
        return;
      }

      const result = data as unknown as { ok: boolean; error?: string } | null;
      if (!result?.ok) {
        setError(
          result?.error === 'too_many'
            ? 'وصلت للحد الأقصى من الرسايل على الطلب ده. كلّمنا من صفحة الدعم.'
            : result?.error === 'too_long'
              ? 'الرسالة طويلة أوي — اختصرها.'
              : 'تعذّر إرسال الرسالة — جرّب تاني.',
        );
        return;
      }

      setMessages((prev) => [
        ...prev,
        { author: 'applicant', body: text, createdAt: new Date().toISOString() },
      ]);
      setBody('');
      router.refresh();
    } catch {
      setError('تعذّر إرسال الرسالة — جرّب تاني.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {messages.length === 0 ? (
        <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
          مفيش رسايل لسه. تقدر تكتب لنا أي حاجة حابب تضيفها على طلبك.
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.author === 'admin'
                  ? 'me-auto max-w-[85%] rounded-2xl rounded-ee-sm border border-slate-200 bg-slate-50 p-4'
                  : 'ms-auto max-w-[85%] rounded-2xl rounded-es-sm bg-emerald-50 p-4'
              }
            >
              <p className="mb-1 text-xs font-bold text-slate-500">
                {m.author === 'admin' ? 'فريق الرحلة' : applicantName}
                {' · '}
                {new Date(m.createdAt).toLocaleString('ar-EG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      <Field label="ردّك">
        <TextArea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب ردّك هنا…"
        />
      </Field>

      <div className="mt-3">
        <BusyButton busy={busy} pendingLabel="بيبعت…" onClick={send} disabled={!body.trim()}>
          <Send className="h-4 w-4" />
          ابعت
        </BusyButton>
      </div>

      <FormError message={error} className="mt-3" />
    </div>
  );
}
