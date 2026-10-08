'use client';

import React from 'react';
import { sendBroadcast } from '@/actions/notifications-admin';
import { Field, TextInput, TextArea, Select, BusyButton } from '@/components/forms/Form';
import { FormError, FormSuccess } from '@/components/ui/FormError';

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
  const [result, setResult] = React.useState<{ ok: boolean; text: string; field?: string } | null>(null);

  const targetLabel = TARGETS.find((t) => t.value === target)?.label ?? '';

  async function send() {
    setSending(true);
    setResult(null);
    let res: Awaited<ReturnType<typeof sendBroadcast>>;
    try {
      res = await sendBroadcast({ title, message, link, target });
    } catch {
      // ⚠️ لو النداء نفسه وقع (شبكة مثلًا) — منقولش «اتبعت» ومنسكتش.
      res = { ok: false, error: 'حصل خطأ غير متوقع — راجع الإشعارات قبل ما تعيد الإرسال.' };
    } finally {
      setSending(false);
      setConfirming(false);
    }
    if (res.ok) {
      setResult({ ok: true, text: `اتبعت لـ ${res.count} حساب.` });
      setTitle('');
      setMessage('');
      setLink('');
    } else {
      setResult({ ok: false, text: res.error, field: res.field });
    }
  }

  const fieldError = (f: string) => (result && !result.ok && result.field === f ? result.text : undefined);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-6">
        <Field label="يروح لمين" name="target" required>
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="font-bold">
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="العنوان" name="title" required error={fieldError('title')}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="مثال: صيانة مجدولة يوم الجمعة"
          />
        </Field>

        <Field
          label={
            <>
              الرسالة <span className="font-medium text-slate-600">(اختياري)</span>
            </>
          }
          name="message"
        >
          <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        </Field>

        <Field
          label={
            <>
              رابط <span className="font-medium text-slate-600">(اختياري)</span>
            </>
          }
          name="link"
        >
          <TextInput
            value={link}
            onChange={(e) => setLink(e.target.value)}
            dir="ltr"
            placeholder="/creative-writing/packages"
            className="text-left"
          />
        </Field>

        {/* خطوة تأكيد مقصودة: الإشعار ما بيترجعش بعد ما يتبعت. */}
        {confirming ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">
              هيتبعت لـ «{targetLabel}» بعنوان «{title.trim()}». مفيش تراجع بعد
              الإرسال.
            </p>
            <div className="mt-4 flex gap-3">
              <BusyButton busy={sending} pendingLabel="جاري الإرسال…" onClick={send}>
                أيوة، ابعت
              </BusyButton>
              <BusyButton
                busy={false}
                variant="secondary"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                رجوع
              </BusyButton>
            </div>
          </div>
        ) : (
          <BusyButton busy={false} onClick={() => setConfirming(true)} disabled={!title.trim()} className="px-8">
            مراجعة وإرسال
          </BusyButton>
        )}

        {result?.ok && <FormSuccess message={result.text} />}
        {/* خطأ الخانة بيظهر تحتها — والباقي هنا. */}
        {result && !result.ok && !result.field && <FormError message={result.text} />}
      </div>
    </div>
  );
}
