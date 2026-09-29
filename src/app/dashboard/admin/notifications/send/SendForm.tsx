'use client';

import React from 'react';
import { sendBroadcast } from '@/actions/notifications-admin';

const TARGETS = [
  { value: 'all', label: 'كل المستخدمين' },
  { value: 'customer', label: 'العملاء' },
  { value: 'instructor', label: 'المدربون' },
  { value: 'service_provider', label: 'مقدّمو الخدمة' },
  { value: 'publisher', label: 'الناشرون' },
  { value: 'student', label: 'الطلاب' },
];

export function SendForm() {
  const [target, setTarget] = React.useState('all');
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [link, setLink] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  const targetLabel = TARGETS.find((t) => t.value === target)?.label ?? '';

  async function send() {
    setSending(true);
    setResult(null);
    const res = await sendBroadcast({ title, message, link, target });
    setSending(false);
    setConfirming(false);
    if (res.ok) {
      setResult({ ok: true, text: `اتبعت لـ ${res.count} حساب.` });
      setTitle('');
      setMessage('');
      setLink('');
    } else {
      setResult({ ok: false, text: res.error });
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">يروح لمين</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-800"
          >
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">العنوان</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="مثال: صيانة مجدولة يوم الجمعة"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            الرسالة <span className="font-medium text-slate-600">(اختياري)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            رابط <span className="font-medium text-slate-600">(اختياري)</span>
          </label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            dir="ltr"
            placeholder="/creative-writing/packages"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-slate-800"
          />
        </div>

        {/* خطوة تأكيد مقصودة: الإشعار ما بيترجعش بعد ما يتبعت. */}
        {confirming ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">
              هيتبعت لـ «{targetLabel}» بعنوان «{title.trim()}». مفيش تراجع بعد
              الإرسال.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال…' : 'أيوة، ابعت'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl bg-white px-6 py-3 font-bold text-slate-700 ring-1 ring-slate-200"
              >
                رجوع
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!title.trim()}
            className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
          >
            مراجعة وإرسال
          </button>
        )}

        {result && (
          <p
            className={`text-sm font-bold ${
              result.ok ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}
