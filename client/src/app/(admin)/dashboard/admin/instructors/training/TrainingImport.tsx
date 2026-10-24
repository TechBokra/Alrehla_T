'use client';

import { useState, useTransition } from 'react';
import { BusyButton, Field, TextInput } from '@/components/forms/Form';
import { importTrainingContent } from '@/actions/training';
import { importCourseFile, type CourseContent } from '@/lib/training';

/**
 * نسخة جديدة من الدورة: الإدارة بترفع ملف HTML زي اللي بيوصلها (v5، v6…)
 * والشاشة بتقرا المحتوى منه وتوريه قبل الحفظ.
 */
export function TrainingImport({ currentVersion }: { currentVersion: string }) {
  const [content, setContent] = useState<CourseContent | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, start] = useTransition();

  const onFile = async (file: File | undefined) => {
    setError('');
    setDone('');
    setContent(null);
    if (!file) return;
    if (file.size > 3_000_000) {
      setError('الملف أكبر من ٣ ميجا.');
      return;
    }
    const r = importCourseFile(await file.text());
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setContent(r.content);
    setVersion(r.version ?? '');
  };

  const pages = content?.modules.reduce((n, m) => n + m.pages.length, 0) ?? 0;
  const moduleQs = content?.modules.reduce((n, m) => n + m.questions.length, 0) ?? 0;
  const critical = content?.finalQuestions.filter((q) => q.critical).length ?? 0;

  return (
    <div className="space-y-4">
      <Field
        label="ملف الدورة (HTML أو JSON)"
        name="courseFile"
        hint={`الإصدار الحالي ${currentVersion}. الملف بيتقري على جهازك وبيتعرض قبل الحفظ — مفيش حاجة بتتغيّر قبل ما تضغط «اعتمد».`}
      >
        <TextInput type="file" accept=".html,.htm,.json,text/html,application/json" onChange={(e) => void onFile(e.target.files?.[0])} />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {content && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            {content.modules.length} وحدات · {pages} صفحة · {moduleQs} سؤال وحدات · {content.finalQuestions.length} سؤال نهائي
            ({critical} حرج) · {content.topics.length} مجالات
          </p>
          <ol className="list-inside list-decimal space-y-1 text-sm font-medium text-slate-700">
            {content.modules.map((m) => (
              <li key={m.title}>{m.title}</li>
            ))}
          </ol>
          <Field label="رقم الإصدار" name="version" required>
            <TextInput value={version} onChange={(e) => setVersion(e.target.value)} maxLength={40} dir="ltr" className="text-left" />
          </Field>
          <p className="text-xs font-bold text-amber-900">
            تقدّم المدربين بيفضل زي ما هو. لو النسخة الجديدة محتاجة إعادة، أعد التأهيل لكل مدرب من ملفه.
          </p>
          <BusyButton
            busy={pending}
            pendingLabel="جارٍ الحفظ…"
            onClick={() =>
              start(async () => {
                const r = await importTrainingContent({ content, version });
                if (!r.ok) setError(r.error);
                else {
                  setDone(`اتحفظ الإصدار ${version}.`);
                  setContent(null);
                }
              })
            }
          >
            اعتمد النسخة دي
          </BusyButton>
        </div>
      )}
      {done && (
        <p role="status" className="text-sm font-bold text-emerald-800">
          {done}
        </p>
      )}
    </div>
  );
}
