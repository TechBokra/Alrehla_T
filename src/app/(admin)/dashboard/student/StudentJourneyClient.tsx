import React from 'react';
import Link from 'next/link';
import { Calendar, MessageSquare } from 'lucide-react';
import { WritingPackage, SessionWithDetails } from '@/types';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

interface Props {
  currentPackage: WritingPackage | null;
  sessions: SessionWithDetails[];
  latestReport: { attendance: 'present' | 'absent'; report: string; createdAt: string } | null;
}

/**
 * The student's current course.
 *
 * Every figure on this card used to be written into the markup: "الجلسة 5 من
 * 12", a 41% progress bar, a fixed weekly slot of "السبت، 4:00 عصراً", a link
 * to a session id that does not exist ("s-123"), an invented message
 * attributed to the instructor, and a star-rating form that saved nothing
 * while thanking the student for their feedback.
 */
export function StudentJourneyClient({ currentPackage, sessions, latestReport }: Props) {
  if (!currentPackage) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
        <p className="font-bold text-slate-500">لا يوجد مسار تدريبي نشط بعد.</p>
      </div>
    );
  }

  const total = sessions.length;
  const done = sessions.filter((s) => s.status === 'completed').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const next = sessions
    .filter((s) => s.status !== 'completed' && s.status !== 'cancelled')
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )[0];

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-lg font-bold text-slate-800">{currentPackage.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{currentPackage.shortDescription}</p>

      {total > 0 && (
        <>
          <div className="mt-6 mb-2 flex justify-between text-sm font-bold text-slate-600">
            <span>
              الجلسة {done} من {total}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-2.5 rounded-full bg-amber-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-800">
          <Calendar className="h-5 w-5 shrink-0 text-blue-500" />
          {next ? (
            <span>
              الجلسة القادمة:{' '}
              {new Date(next.scheduledAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE,
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </span>
          ) : (
            <span className="text-slate-500">لا توجد جلسة قادمة مجدولة.</span>
          )}
        </div>

        {next && (
          <Link
            href={`/dashboard/student/sessions/${next.id}`}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            تفاصيل الجلسة
          </Link>
        )}
      </div>

      {latestReport && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-bold text-slate-800">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            ملاحظات المدرب من الجلسة السابقة
          </h4>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
            {latestReport.report || 'سجّل المدرب الحضور بدون ملاحظات.'}
          </p>
        </div>
      )}
    </div>
  );
}
