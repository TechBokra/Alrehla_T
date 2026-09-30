import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  getSessionAttachments,
  getSessionMessages,
  getSessions,
  getInstructorById,
  getWritingPackages,
  getSessionReport,
} from '@/data/domains/writing';
import { getParticipantName } from '@/data/domains/account';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { sessionStatusView } from '@/lib/session-status';
import { StatusBadge } from '@/components/StatusBadge';
import { notFound } from 'next/navigation';
import { SessionSettings } from './SessionSettings';
import { FileText, Download, Upload } from 'lucide-react';
import { PLATFORM_TIMEZONE, formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * صفحة الجلسة الواحدة في لوحة الإدارة.
 *
 * ⚠️ **الصفحة دي كانت بلا حارس صلاحيات.** كل صفحة تانية تحت
 *    `/dashboard/admin` بتبدأ بـ`hasAdminPermission`، ودي لأ. مفيش
 *    تسريب بيانات حصل — صلاحيات القاعدة بترجّع لكل واحد جلساته هو —
 *    لكن أي مستخدم مسجَّل كان بيفتح شاشة إدارية ويشوف واجهة الإدارة
 *    على بياناته. والخطر الحقيقي إن الحارس المفقود بيبقى صح **بالحظ**:
 *    أول ما سياسة قراءة تتوسّع لأي سبب، الصفحة دي بتبقى باب.
 *
 * ⚠️ و`backHref` كانت بتودّي **لوحة المدرب** من جوّه لوحة الإدارة —
 *    الصفحة كانت منسوخة من شاشة المدرب والرابط ما اتغيّرش.
 */
export default async function AdminSessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  const admin = await getCurrentUser();
  if (!hasAdminPermission(admin, 'canManageBookings')) {
    return <Unauthorized />;
  }

  // The session details on this page — date, package and student — were all
  // written into the markup and identical for every session.
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) notFound();

  const [messages, attachments, instructor, packages, report] = await Promise.all([
    getSessionMessages(sessionId),
    getSessionAttachments(sessionId),
    session.instructorId ? getInstructorById(session.instructorId) : Promise.resolve(null),
    getWritingPackages(),
    getSessionReport(sessionId),
  ]);

  const pkg = packages.find((p) => p.id === session.packageId);
  const studentName = await getParticipantName(session.childId, session.userId);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader 
        title={`جلسة ${session.sessionNumber} — ${studentName}`} 
        backHref="/dashboard/admin/sessions"
        action={
          session.meetingUrl
            ? { label: 'الدخول للجلسة', href: session.meetingUrl }
            : undefined
        }
      />

      <div className="grid gap-8 md:grid-cols-3">
        {/* التفاصيل والمرفقات */}
        <div className="space-y-8 md:col-span-1">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-800">معلومات الجلسة</h2>
            <div className="space-y-4 text-sm font-medium">
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-slate-500">التاريخ والوقت</span>
                <span className="font-bold text-slate-800">
                  {new Date(session.scheduledAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE,
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-slate-500">الباقة</span>
                <span className="font-bold text-slate-800">{pkg?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-slate-500">المتدرب</span>
                <span className="font-bold text-slate-800">{studentName}</span>
              </div>
              {/* الحالة كانت ناقصة من الشاشة خالص — وهي أول حاجة الإدارة
                  بتسأل عنها لما تفتح جلسة. */}
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-slate-500">الحالة</span>
                <StatusBadge
                  type={sessionStatusView(session.status).badge}
                  label={sessionStatusView(session.status).label}
                />
              </div>
            </div>
          </section>

          <SessionSettings
            sessionId={session.id}
            meetingUrl={session.meetingUrl ?? ''}
            scheduledAt={session.scheduledAt}
          />

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">المرفقات</h2>

            </div>
            <div className="space-y-3">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                    <span className="truncate text-sm font-bold text-slate-700">{file.fileName}</span>
                  </div>
                  <a href={file.fileUrl} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:text-slate-800">
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* الرسائل المتبادلة */}
        <div className="md:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
            <h2 className="mb-6 text-xl font-bold text-slate-800">الرسائل والملاحظات</h2>
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-4">
              {messages.map((msg) => {
                // Alignment used to be decided by comparing the sender's name
                // to one hard-coded instructor, so every other instructor's
                // messages rendered as if the student had sent them.
                const isInstructor =
                  Boolean(instructor) && msg.senderName === instructor?.displayName;
                return (
                  <div key={msg.id} className={`flex flex-col ${isInstructor ? 'items-start' : 'items-end'}`}>
                    <div className="mb-1 text-xs font-bold text-slate-500">{msg.senderName}</div>
                    <div className={`rounded-2xl px-5 py-3 text-sm font-medium shadow-sm ${isInstructor ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-tl-none' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tr-none'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* An input and a send button used to sit here with no handler on
                either: a note typed for the student went nowhere. The
                instructor's saved session report is shown instead. */}
            <div className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="mb-2 font-bold text-slate-800">تقرير المدرب</h3>
              {report ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-bold text-slate-600">
                    الحضور: {report.attendance === 'present' ? 'حضر' : 'لم يحضر'}
                    <span className="ms-2 font-medium text-slate-400">
                      · سُجّل {formatCairo(report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                    {report.report || 'بدون ملاحظات.'}
                  </p>
                </div>
              ) : (
                <p className="font-medium text-slate-600">لم يسجّل المدرب تقريرًا بعد.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
