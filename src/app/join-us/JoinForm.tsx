'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { submitJoinRequest } from '@/actions/join-requests';

const ROLES = [
  { value: 'instructor', label: 'مدرب/ة في «بداية الرحلة»' },
  { value: 'illustrator', label: 'رسام/ة لقصص «إنها لك»' },
  { value: 'voiceover', label: 'معلق/ة صوتي/ة' },
  { value: 'author', label: 'كاتب/ة قصص أطفال' },
  { value: 'other', label: 'دور آخر' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium transition-all outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';

export function JoinForm() {
  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    phone: '',
    requestedRole: '',
    portfolioUrl: '',
    message: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm({ ...form, [key]: e.target.value });

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
        <div>
          <p className="font-black text-emerald-900">وصلنا طلبك.</p>
          <p className="text-sm font-medium text-emerald-800">
            سنراجعه ونتواصل معك على البريد الذي أدخلته.
          </p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      // ⚠️ النتيجة بتتقرا دلوقتي. الأكشن كان بيرمي برسايل عربية
      //    («اكتب اسمك»)، وNext بيمسح نص أي خطأ مرميّ في النسخة
      //    المنشورة — فالمتقدّم كان بيشوف نصًّا إنجليزيًا عامًّا.
      const result = await submitJoinRequest(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">الاسم</label>
          <input
            type="text"
            className={inputClass}
            placeholder="الاسم الكامل"
            value={form.applicantName}
            onChange={set('applicantName')}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
          <input
            type="email"
            dir="ltr"
            className={`${inputClass} text-right`}
            placeholder="example@email.com"
            value={form.email}
            onChange={set('email')}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">رقم الهاتف</label>
          <input
            type="tel"
                    inputMode="tel"
                    pattern="[+]?[0-9\s()-]{7,20}"
            dir="ltr"
            className={`${inputClass} text-right`}
            placeholder="رقم الهاتف مع رمز الدولة"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">الدور المطلوب</label>
          <select
            className={inputClass}
            value={form.requestedRole}
            onChange={set('requestedRole')}
          >
            <option value="">اختر الدور المناسب</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">
          رابط معرض الأعمال (اختياري)
        </label>
        <input
          type="url"
          dir="ltr"
          className={`${inputClass} text-right`}
          placeholder="https://"
          value={form.portfolioUrl}
          onChange={set('portfolioUrl')}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">الرسالة</label>
        <textarea
          rows={4}
          className={`${inputClass} resize-none`}
          placeholder="حدثنا عن نفسك وعن سبب رغبتك بالانضمام لنا..."
          value={form.message}
          onChange={set('message')}
        />
      </div>

      <Button
        type="button"
        onClick={submit}
        disabled={busy}
        accentColor="amber"
        className="!hover:bg-slate-800 w-full !bg-slate-900"
      >
        {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
      </Button>
    </div>
  );
}
