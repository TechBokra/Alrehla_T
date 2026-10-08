'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Calendar, Check } from 'lucide-react';
import { updateSessionDetails } from '@/actions/admin-sessions';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { cairoParts } from '@/lib/timezone';

/**
 * لحظة مخزّنة ← قيمة خانة `datetime-local` **بساعة القاهرة**.
 *
 * ⚠️ كانت بتستخدم ساعة جهاز الإداري (`getHours`)، والحفظ كان بيبعت
 *    `toISOString()` (بتوقيت جرينتش) — والخادم بيقرا النص كساعة قاهرة
 *    (`parseCairoInput`)، فالجلسة كانت بتتسجّل متأخرة ٢–٣ ساعات عن
 *    الموعد اللي اتكتب. دلوقتي الخانة بتعرض ساعة القاهرة، والنص بيتبعت
 *    زي ما اتكتب، والخادم بيحوّله.
 */
function toLocalInput(iso: string): string {
  const p = cairoParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The session's meeting room and time.
 *
 * Without this there was no way to set a meeting link anywhere in the site,
 * so every session showed "رابط الجلسة لم يُضَف بعد" to both the instructor
 * and the student.
 */
export function SessionSettings({
  sessionId,
  meetingUrl,
  scheduledAt,
}: {
  sessionId: string;
  meetingUrl: string;
  scheduledAt: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(meetingUrl);
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setErrorField(undefined);
    setSaved(false);
    try {
      // ⚠️ الأكشن بقى بيرجّع النتيجة بدل ما يرمي (قاعدة «هـ»).
      const result = await updateSessionDetails({
        sessionId,
        meetingUrl: url,
        // النص زي ما اتكتب (ساعة القاهرة) — الخادم بيحوّله (`parseCairoInput`).
        scheduledAt: when,
      });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-bold text-slate-800">إعدادات الجلسة</h2>
      <p className="mb-5 text-sm font-medium text-slate-500">
        أي تعديل هنا يصل للمدرب والمتدرب كإشعار.
      </p>

      {/* خطأ الخانة بيظهر تحتها؛ الباقي هنا. */}
      <FormError message={errorField ? '' : error} className="mb-4" />
      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" /> تم الحفظ.
        </p>
      )}

      <div className="space-y-4">
        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" /> رابط غرفة الجلسة
            </span>
          }
          error={errorField === 'meetingUrl' ? error : undefined}
        >
          <TextInput
            name="meetingUrl"
            className="text-left"
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> موعد الجلسة
            </span>
          }
          required
          error={errorField === 'scheduledAt' ? error : undefined}
        >
          <TextInput
            type="datetime-local"
            name="scheduledAt"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>

        <div className="flex justify-end">
          <BusyButton busy={busy} onClick={save}>
            حفظ
          </BusyButton>
        </div>
      </div>
    </section>
  );
}
