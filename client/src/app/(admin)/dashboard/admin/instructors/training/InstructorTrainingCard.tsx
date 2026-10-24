import Link from 'next/link';
import {
  TRAINING_STATUS_LABELS,
  activeDuration,
  doneCount,
  moduleDone,
  trainingStatus,
} from '@/lib/training';
import type { AdminCourse, LearnerRecord } from '@/data/domains/(admin)/training/queries';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { ResetTrainingButton } from './ResetTrainingButton';

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) : '—';
const ar = (n: number) => n.toLocaleString('ar-EG');

const TONE = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-sky-50 text-sky-900',
  ready_for_final: 'bg-amber-50 text-amber-900',
  passed: 'bg-emerald-50 text-emerald-900',
} as const;

/** التأهيل التأسيسي في ملف المدرب — بدل التقرير اللي كان بيتبعت بالإيميل. */
export function InstructorTrainingCard({
  course,
  record,
  userId,
  instructorId,
}: {
  course: AdminCourse | null;
  record: LearnerRecord | undefined;
  userId: string | null;
  instructorId: string;
}) {
  if (!course) {
    return (
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-black text-slate-800">التأهيل التأسيسي</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">التأهيل لسه مش مفعّل في القاعدة.</p>
      </section>
    );
  }
  const total = course.content.modules.length;
  const progress = record?.progress ?? null;
  const status = trainingStatus(progress, total);
  return (
    <section className="mt-10 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800">التأهيل التأسيسي</h2>
          <p className="text-sm font-medium text-slate-500">
            المدرب بيدرسه من لوحته · الإصدار {course.version}
            {course.requiredForActivation ? ' · إلزامي قبل التفعيل' : ''}
          </p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-black ${TONE[status]}`}>{TRAINING_STATUS_LABELS[status]}</span>
      </div>

      {!userId ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">المدرب ده مالوش حساب دخول — مايقدرش يدرس التأهيل.</p>
      ) : (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              ['الوحدات', `${ar(doneCount(progress, total))} / ${ar(total)}`],
              ['أعلى درجة نهائية', progress?.bestScore != null ? `${ar(progress.bestScore)}٪` : '—'],
              ['محاولات التقييم', ar(progress?.finalAttempts ?? 0)],
              ['وقت الدراسة', progress ? activeDuration(progress.activeSeconds) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs font-bold text-slate-500">{k}</dt>
                <dd className="mt-1 font-black text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {progress?.passedAt && (
            <p className="text-sm font-bold text-emerald-800">
              اجتاز في {when(progress.passedAt)} (إصدار {progress.passedVersion ?? '—'}). الاجتياز مش اعتماد — التدريب
              العملي وخانة «اجتاز التدريب والاختبار» فوق لسه قرارك.
            </p>
          )}
          {progress && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {course.content.modules.map((m, i) => {
                const mp = progress.modules[String(i)];
                return (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <span className="font-bold text-slate-800">
                      {ar(i + 1)}. {m.title}
                    </span>
                    <span className={`shrink-0 text-xs font-black ${moduleDone(progress, i) ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {mp ? `${ar(mp.bestScore)}/${ar(mp.total)} · ${ar(mp.attempts)} محاولة` : 'لسه'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {record && record.attempts.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-black text-slate-800">محاولات التقييم النهائي</p>
              <ul className="space-y-1.5 text-sm">
                {record.attempts.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-700">{when(a.submittedAt)} · إصدار {a.courseVersion}</span>
                    <span className={`font-black ${a.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ar(a.score)}٪ · حرج {ar(a.criticalCorrect)}/{ar(a.criticalTotal)} · {a.passed ? 'ناجح' : 'لم يجتز'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {record?.resetAt && <p className="text-xs font-medium text-slate-500">آخر إعادة للتأهيل: {when(record.resetAt)}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <Link href="/dashboard/admin/instructors/training" className="text-sm font-bold text-emerald-800 hover:underline">
              إعدادات التأهيل ونتايج كل المدربين ←
            </Link>
            {progress && <ResetTrainingButton userId={userId} instructorId={instructorId} />}
          </div>
        </>
      )}
    </section>
  );
}
