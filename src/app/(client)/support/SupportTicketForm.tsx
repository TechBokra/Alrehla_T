'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
          href="/sign-in?callbackUrl=/support"
          className="font-bold text-amber-800 underline"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await createSupportTicket({ subject, category, message });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر فتح التذكرة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">التصنيف</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all outline-none focus:border-amber-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">الموضوع</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="عنوان مختصر للمشكلة"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium transition-all outline-none focus:border-amber-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">التفاصيل</label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اشرح مشكلتك أو استفسارك..."
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium transition-all outline-none focus:border-amber-500"
        />
      </div>

      <Button
        type="button"
        onClick={submit}
        disabled={busy}
        accentColor="amber"
        className="!hover:bg-slate-800 mt-2 w-full !bg-slate-900 shadow-md"
      >
        {busy ? 'جارٍ الإرسال…' : 'إرسال التذكرة'}
      </Button>
    </div>
  );
}
