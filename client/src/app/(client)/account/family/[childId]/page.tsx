import { SessionChangeRequest } from '@/components/sessions/SessionChangeRequest';
import { SessionJoinButton } from '@/components/sessions/SessionJoinButton';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, FileText, Video, ArrowLeft } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { getDependentFollowUpData } from '@/data/domains/(client)/family/follow-up';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';
import { SessionReportCard } from '@/components/sessions/SessionReportCard';
import { getSessionReportsFor } from '@/data/domains/(shared)/sessions/reports';

export const dynamic = 'force-dynamic';

/**
 * متابعة ولي الأمر لابنه — في مكان واحد.
 *
 * ── إيه اللي كان ناقص ───────────────────────────────────────
 *
 * متابعة الطفل كانت **مبعثرة**: الباقة في «باقات بداية الرحلة»
 * بعدّاد «3 من 8» وبس، والجلسات مش ظاهرة بمواعيدها، ومعرض الأعمال
 * مكانش ظاهر خالص. ولي الأمر عايز يعرف حاجة واحدة — «ابني ماشي
 * إزاي؟» — وكان لازم يلف على تلات شاشات ويجمّعها بنفسه.
 *
 * ── الصلاحيات — مفيش حاجة جديدة اتفتحت ──────────────────────
 *
 * كل اللي بيتعرض هنا ولي الأمر يقدر يقراه أصلًا:
 *
 *   • الاشتراكات: هو صاحبها (`course_subscriptions.user_id`)
 *   • الجلسات: الصلاحيات بتدّي جلسات الاشتراك لصاحبه
 *   • المستندات: سياسة `Guardians read their dependents documents`
 *     (ملف SQL 89)
 *   • أسماء المدربين: `public_instructors()` — دالة عامة (ملف 83)
 *
 * ⚠️ **ومفيش أي رقم فلوس هنا عن قصد.** الصفحة دي عن تقدّم الطفل،
 *    والمدفوعات ليها شاشتها. خلط الاتنين بيحوّل المتابعة لفاتورة.
 */
export default async function DependentFollowUpPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const result = await getDependentFollowUpData(childId);
  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="space-y-8">
        <DashboardPageHeader title="متابعة الطفل" backHref="/account/family" />
        <FormError message={result.error.message} />
      </div>
    );
  }
  const {
    child,
    subscriptions: mySubs,
    sessions: mySessions,
    documents,
    nextSession,
    nextChange,
    age,
    reviewed,
  } = result.data;
  // تقارير المدرب عن الجلسات اللي تمّت (ملاحظة الفريق، 10 أكتوبر).
  const reports = await getSessionReportsFor(
    mySessions.filter((s) => s.status === 'completed').map((s) => s.id),
  );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={`متابعة ${child.fullName}`}
        backHref="/account/family"
      />

      <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <PersonAvatar
          name={child.fullName}
          avatarUrl={child.avatarUrl}
          size={64}
        />
        <div>
          <h2 className="text-xl font-black text-slate-800">
            {child.fullName}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {age !== null ? `${age} سنة` : 'تاريخ الميلاد مش مسجّل'}
            {child.accountProfileId
              ? ' · عنده حساب دخول'
              : ' · من غير حساب دخول'}
          </p>
        </div>
      </div>

      {/* ── الجلسة الجاية ───────────────────────────────────
          أهم معلومة لولي الأمر، فمكانها فوق وبشكل مختلف. */}
      {nextSession && (
        <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-emerald-900">
            <Calendar className="h-5 w-5" />
            الجلسة الجاية
          </h2>
          <p className="font-bold text-slate-800">
            {formatCairo(nextSession.scheduledAt)}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {nextSession.packageName}
            {nextSession.instructorName &&
              ` · مع ${nextSession.instructorName}`}
          </p>
          {/* الغرفة اللي النظام بيعملها كانت للإدارة بس (5.3) — دلوقتي لولي الأمر كمان. */}
          <SessionJoinButton
            sessionId={nextSession.id}
            meetingUrl={nextSession.meetingUrl}
            label="ادخل الجلسة"
            className="mt-4"
          />
          {/* ⭐ (#LQMO) ولي الأمر يطلب موعد تاني — الإدارة بتوافق. */}
          <div className="mt-4">
            <SessionChangeRequest
              sessionId={nextSession.id}
              existing={nextChange}
              scheduledAt={nextSession.scheduledAt}
            />
          </div>
        </section>
      )}

      {/* ── الباقات ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-800">باقاته</h2>
        {mySubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center font-medium text-slate-500">
            مفيش باقات مسجّلة باسم {child.fullName}.
          </p>
        ) : (
          mySubs.map((sub) => {
            return (
              <div
                key={sub.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="font-bold text-slate-800">
                  {sub.packageName}
                </span>
                <span className="text-sm font-bold text-slate-600">
                  {sub.sessionCount > 0
                    ? `${sub.completedSessions} من ${sub.sessionCount} جلسة`
                    : 'الجلسات لسه ما اتجدولتش'}
                </span>
              </div>
            );
          })
        )}
      </section>

      {/* ── الجلسات ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-800">جلساته</h2>
        {mySessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center font-medium text-slate-500">
            {/* ⚠️ السبب الحقيقي مش «مفيش جلسات»: الجدولة بتحصل بعد
                تأكيد الدفع، فالجملة بتقول ده بدل ما ولي الأمر يفتكر
                إن في عطل. */}
            الجلسات بتتجدول بعد تأكيد الدفع — مفيش مواعيد مسجّلة لسه.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {mySessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0"
              >
                <div>
                  <p className="font-bold text-slate-800">
                    الجلسة {s.sessionNumber}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {formatCairo(s.scheduledAt)}
                    {s.instructorName && ` · ${s.instructorName}`}
                  </p>
                </div>
                {s.status === 'completed' ? (
                  <StatusBadge type="success" label="تمّت" />
                ) : s.status === 'cancelled' ? (
                  <StatusBadge type="neutral" label="ملغاة" />
                ) : (
                  <StatusBadge type="warning" label="قادمة" />
                )}
                {reports.get(s.id) && (
                  <div className="w-full">
                    <SessionReportCard report={reports.get(s.id)!} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── معرض الأعمال ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-800">معرض أعماله</h2>
        {!child.accountProfileId ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed font-medium text-amber-900">
            معرض الأعمال بيتكتب من حساب الطالب نفسه، و{child.fullName} لسه مالوش
            حساب دخول. تقدر تفتحله واحدًا من عمود «حساب الدخول» في المركز
            العائلي.
          </p>
        ) : (
          <Link
            href={`/account/family/${child.id}/portfolio`}
            className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-amber-300"
          >
            <span className="flex items-center gap-2 font-bold text-slate-800">
              <FileText className="h-5 w-5 text-slate-400" />
              {documents.length === 0
                ? 'لسه ما كتبش نصوصًا'
                : `${documents.length} نص · ${reviewed} راجعهم المدرب`}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-amber-700">
              افتح المعرض
              <ArrowLeft className="h-4 w-4" />
            </span>
          </Link>
        )}
      </section>
    </div>
  );
}
