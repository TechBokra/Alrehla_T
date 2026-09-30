'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Calendar, Check } from 'lucide-react';
import { updateSessionDetails } from '@/actions/admin-sessions';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

/** Turn an ISO timestamp into the value a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await updateSessionDetails({
        sessionId,
        meetingUrl: url,
        scheduledAt: new Date(when).toISOString(),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ');
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

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" /> تم الحفظ.
        </p>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Video className="h-3.5 w-3.5" /> رابط غرفة الجلسة
          </label>
          <input
            className={`${inputClass} text-left`}
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Calendar className="h-3.5 w-3.5" /> موعد الجلسة
          </label>
          <input
            type="datetime-local"
            className={inputClass}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </section>
  );
}
