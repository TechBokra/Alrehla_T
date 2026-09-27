'use client';
import React, { useState } from 'react';
import { InstructorSession } from '@/types';
import { Video, Clock, User, CheckCircle2, AlertCircle, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveSessionReport } from '@/actions/sessions';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

interface Props {
  session: InstructorSession;
}

export function InstructorSessionClient({ session }: Props) {
  const [attendance, setAttendance] = useState<'present' | 'absent' | null>(null);
  const [report, setReport] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendance) {
      setError('سجّل الحضور أولاً');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      // ⚠️ **النتيجة بتتقري دلوقتي.** الشاشة كانت بترميها وبتعرض
      //    «تم الحفظ» مهما رجع — وده اللي خلّى المدرب يشوف نجاحًا
      //    والتقرير ما يوصلش لحد.
      const result = await saveSessionReport({ sessionId: session.id, attendance, report });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsSubmitted(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ التقرير');
    } finally {
      setIsSaving(false);
    }
  };

  // كان الاسم بيتعرض كـ«الطالب #» + جزء من رقم الحساب المقطوع على
  // الشرطة. الاسم الحقيقي بييجي مع الجلسة دلوقتي.
  const studentId = session.studentRef;

  return (
    <div className="space-y-8">
      {/* Session Header / Join Link */}
      <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <Video className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-indigo-900 mb-1">غرفة التدريب المرئية</h2>
            <div className="flex items-center gap-3 text-indigo-700 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(session.scheduledAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1"><User className="h-4 w-4" /> مع {session.participantName}</span>
            </div>
          </div>
        </div>
        
        {session.meetingUrl ? (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-xl bg-indigo-600 px-8 py-4 text-center font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:w-auto"
          >
            دخول الجلسة الآن
          </a>
        ) : (
          <span className="w-full rounded-xl bg-white/70 px-8 py-4 text-center font-bold text-indigo-700 md:w-auto">
            رابط الجلسة لم يُضَف بعد
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {isSubmitted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3 text-emerald-800">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold text-lg mb-1">تم تسجيل الجلسة بنجاح</p>
            <p className="text-sm">تم حفظ الحضور والتقرير. الإدارة والمتدرب يمكنهما الاطلاع عليه.</p>
          </div>
        </div>
      )}

      {/* Post-Session Actions */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar: Attendance & Student Info */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-black text-slate-800 mb-4 text-lg">بيانات الطالب</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">ط</div>
              <div>
                <Link href={`/dashboard/instructor/students/${studentId}`} className="font-bold text-blue-600 hover:underline">{session.participantName}</Link>
                {/* ⚠️ **كان نصًّا ثابتًا: «باقة شغف الكتابة (الشهر الثاني)».**

                    ومفيش باقة بالاسم ده في الموقع أصلًا، والطالب كان
                    في أول حصة. يعني المدرب بيقرا بيانات **مخترعة** عن
                    طالب حقيقي قدامه في الجلسة.

                    والاسم الحقيقي موجود في `session.packageName` ورقم
                    الجلسة في `session.sessionNumber` — والاتنين كانوا
                    متاحين ومحدّش بيقراهم. */}
                <p className="text-xs text-slate-500">
                  {session.packageName
                    ? `${session.packageName} · الجلسة ${session.sessionNumber}`
                    : `الجلسة ${session.sessionNumber}`}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-black text-slate-800 mb-4 text-lg">تسجيل الحضور</h3>
            <p className="text-sm text-slate-500 mb-4">هل حضر الطالب الجلسة اليوم؟ (يؤثر على المستحقات وتقرير الطالب)</p>
            
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setAttendance('present')}
                disabled={isSubmitted}
                className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 font-bold transition-colors ${
                  attendance === 'present' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                حضر الجلسة
              </button>
              <button
                type="button"
                onClick={() => setAttendance('absent')}
                disabled={isSubmitted}
                className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 font-bold transition-colors ${
                  attendance === 'absent' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <AlertCircle className="h-5 w-5" />
                لم يحضر (غياب)
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: Post-Session Report */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="h-6 w-6 text-emerald-600" />
              <h3 className="text-xl font-black text-slate-800">تقرير الجلسة (للطالب والإدارة)</h3>
            </div>
            
            <div className="space-y-6">
              <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 text-sm text-blue-800">
                <p><strong>ملاحظة للمدرب:</strong> يُرجى كتابة ملخص قصير لما تم إنجازه اليوم، والمهام المطلوبة من الطالب للجلسة القادمة. هذا التقرير سيظهر في حساب الطالب.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">ملاحظات وتقدم الطالب في الجلسة</label>
                <textarea 
                  required
                  disabled={isSubmitted}
                  rows={6}
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  placeholder="اكتب هنا ما تم إنجازه، نقاط القوة، والأمور التي تحتاج لتحسين..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                ></textarea>
              </div>

              {!isSubmitted && (
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={!attendance || !report || isSaving}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                    {isSaving ? 'جارٍ الحفظ…' : 'حفظ وإرسال التقرير'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
