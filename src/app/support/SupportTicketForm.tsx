'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Field, TextInput, TextArea, Select, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { createSupportTicket } from '@/actions/support';

const CATEGORIES = [
  { value: 'طلب إنها لك', label: 'طلب «إنها لك»' },
  { value: 'بداية الرحلة', label: '«بداية الرحلة»' },
  { value: 'الحساب والدفع', label: 'الحساب والدفع' },
  { value: 'شراكات', label: 'شراكات' },
  { value: 'أخرى', label: 'أخرى' },
];

/**
 * Opening a support ticket.
 *
 * This form used to be a `<form>` with no action and a `type="button"` submit:
 * every ticket a customer wrote was discarded the moment they clicked send,
 * under a promise of a reply.
 */
export function SupportTicketForm({ isSignedIn }: { isSignedIn: boolean }) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // الخانة اللي الخادم رجّع عليها الخطأ — الرسالة بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="text-sm">
          <p className="font-bold text-emerald-900">تم فتح التذكرة.</p>
          <Link href="/account/support" className="font-bold text-emerald-700 underline">
            تابع الرد في تذاكر الدعم
          </Link>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm">
        <p className="mb-3 font-bold text-amber-900">
          سجّل الدخول لفتح تذكرة دعم حتى يصلك الرد على حسابك.
        </p>
        <Link
          href="/sign-in?next=/support"
          className="font-bold text-amber-800 underline"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const err = (f: string) => (errorField === f ? error : undefined);

  const submit = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    try {
      const result = await createSupportTicket({ subject, category, message });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setDone(true);
    } catch {
      setError('تعذّر فتح التذكرة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* الخطأ اللي على خانة بعينها بيظهر تحتها؛ الباقي هنا. */}
      <FormError message={errorField ? '' : error} />

      <Field label="التصنيف" name="category" error={err('category')}>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="الموضوع" name="subject" required error={err('subject')}>
        <TextInput
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="عنوان مختصر للمشكلة"
        />
      </Field>

      <Field label="التفاصيل" name="message" required error={err('message')}>
        <TextArea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اشرح مشكلتك أو استفسارك..."
          className="resize-none"
        />
      </Field>

      <BusyButton
        busy={busy}
        pendingLabel="جارٍ الإرسال…"
        onClick={submit}
        className="mt-2 w-full"
      >
        إرسال التذكرة
      </BusyButton>
    </div>
  );
}
