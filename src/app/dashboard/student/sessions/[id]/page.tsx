import { getCurrentUser } from '@/data/domains/auth';
import { getSessions, getPublicInstructorById } from '@/data/domains/writing';
import { notFound, redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Video, Clock, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * One session for the student.
 *
 * The page used to ignore its own [id] entirely and print the same invented
 * details for every session: "اليوم، 16:00", "مع المدرب أحمد محمود", and a
 * link to Google Meet's home page.
 */
export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) notFound();

  // ⚠️ **كانت `getInstructorById` — وهي `select('*')`.**
  //
  //    الصفحة دي بتعرض **اسم المدرب وبس**، وكانت بتجيب الصف كامل:
  //    `approved_price` و`requested_price` و`monthly_hours_committed`
  //    — تسعير داخلي بين المنصة والمدرب — **بيتبعت في حمولة صفحة
  //    الطالب**، وأي حد يفتح «مصدر الصفحة» يقراه.
  //
  //    الدالة العامة بترجّع الأعمدة الآمنة وحدها (ملف 83).
  const instructor = session.instructorId
    ? await getPublicInstructorById(session.instructorId)
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title={`موعد الجلسة`} 
        backHref="/dashboard/student"
      />
      
      <div className="space-y-8">
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
                {instructor && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" /> مع {instructor.displayName}
                    </span>
                  </>
                )}
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
              دخول الجلسة
            </a>
          ) : (
            <span className="w-full rounded-xl bg-white/70 px-8 py-4 text-center font-bold text-indigo-700 md:w-auto">
              رابط الجلسة لم يُضَف بعد
            </span>
          )}
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-blue-800">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold mb-1">تعليمات الجلسة</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>تأكد من استقرار اتصال الإنترنت قبل الدخول.</li>
              <li>جهز مسودتك أو ملف الكتابة لمشاركته مع المدرب.</li>
              <li>الجلسة تبدأ في موعدها المحدد، يُرجى الالتزام بالحضور.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
