'use client';

import React, { useState } from 'react';
import { Check, Copy, MessageSquare, Send } from 'lucide-react';
import { postJoinRequestMessage } from '@/actions/join-requests';
import { Field, TextArea, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { whatsappLink } from '@/lib/join-token';

export type ThreadMessage = {
  author: 'admin' | 'applicant';
  body: string;
  createdAt: string;
};

/**
 * نقاش الإدارة مع المتقدّم على طلب الانضمام.
 *
 * ⚠️ **المتقدّم مالوش حساب** — `join_requests` فيه اسم وبريد وتليفون
 *    وبس. فبيقرا ويرد من **رابط بمفتاح سري**، والإدارة بتبعتله الرابط
 *    زي ما بتبعت الرمز المؤقت بالظبط (واتساب).
 *
 * ⚠️ **والرابط ده كلمة السر الوحيدة على الصفحة.** عشان كده بيتنسخ من
 *    زرار، مش مكتوب في مكان يتصوّر بالغلط مع باقي الشاشة.
 */
export function JoinRequestThread({
  requestId,
  applicantName,
  messages,
  shareUrl,
  phone = '',
}: {
  /** واتساب المتقدّم (إلزامي في الطلبات الجديدة). */
  phone?: string;
  requestId: string;
  applicantName: string;
  messages: ThreadMessage[];
  /** رابط المتقدّم — فاضي لو الملف لسه ما اتشغّلش. */
  shareUrl: string;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState('');

  const send = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    setSent('');
    try {
      const r = await postJoinRequestMessage(requestId, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBody('');
      setSent(r.emailed ? 'اتبعتت، ووصله إيميل بالرابط. ابعتهوله على الواتساب كمان عشان يشوفها أسرع.' : 'اتبعتت. ابعتله الرابط على الواتساب.');
    } catch {
      setError('تعذّر إرسال الرسالة — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  const invite = `أهلًا ${applicantName} 🌿\n\nعندنا سؤال على طلب انضمامك للرحلة. تقدر تقرا وترد من هنا:\n\n${shareUrl}\n\nفريق الرحلة`;
  // ⚠️ واتساب بيفتح المحادثة والرسالة جاهزة — الإرسال نفسه بضغطة من الإداري.
  const wa = shareUrl && phone ? whatsappLink(phone, invite) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
          <MessageSquare className="h-5 w-5 text-slate-500" />
          النقاش مع المتقدّم
        </h2>
        <div className="flex flex-wrap gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-emerald-700"
          >
            <Send className="h-3.5 w-3.5" />
            ابعت الرابط على واتساب
          </a>
        )}
        {shareUrl && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'اتنسخت' : 'انسخ رسالة فيها رابط النقاش'}
          </button>
        )}
        </div>
      </div>

      <p className="mb-4 text-xs font-medium text-slate-500">
        المتقدّم لسه مالوش حساب، فبيقرا ويرد من رابط خاص. ابعتله الرابط مرة
        واحدة على الواتساب وهو يفضل شغّال طول ما الطلب موجود — وكل رسالة منك
        بيوصله بيها إيميل تلقائي فيه نفس الرابط.
      </p>

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
          مفيش رسايل لسه. اكتب أول سؤال وابعتله الرابط.
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.author === 'admin'
                  ? 'ms-auto max-w-[85%] rounded-2xl rounded-es-sm bg-emerald-50 p-4'
                  : 'me-auto max-w-[85%] rounded-2xl rounded-ee-sm border border-slate-200 bg-white p-4'
              }
            >
              <p className="mb-1 text-[11px] font-bold text-slate-500">
                {m.author === 'admin' ? 'الإدارة' : applicantName}
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

      <Field label="رسالة للمتقدّم">
        <TextArea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اسأله عن شغله، أو اطلب نموذج، أو اتفقوا على ميعاد مكالمة…"
        />
      </Field>

      <div className="mt-3">
        <BusyButton busy={busy} pendingLabel="بيبعت…" onClick={send} disabled={!body.trim()}>
          <Send className="h-4 w-4" />
          ابعت
        </BusyButton>
      </div>

      <FormError message={error} className="mt-3" />
      {sent && !error && (
        <p role="status" className="mt-3 text-sm font-bold text-emerald-800">
          {sent}
        </p>
      )}
    </section>
  );
}
