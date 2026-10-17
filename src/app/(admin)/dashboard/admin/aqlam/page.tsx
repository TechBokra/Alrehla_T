import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, FormActions, TextArea, TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  labelUsers,
  listAdminPosts,
  listOpenReports,
  listPendingGuardianRequests,
  listPostEdits,
} from '@/data/domains/(shared)/aqlam/admin';
import { decideGuardianRequest, handleReport, moderatePost } from '@/actions/aqlam';
import { SanctionBox } from './SanctionBox';
import { Heading, Person, PostEdits, REASON_LABELS, who } from './_shared';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { hasAdminPermission, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * أقلام الرحلة ← الصندوق: كل اللي بيستنى قرار الإدارة (نصوص للمراجعة، طلبات
 * أولياء الأمور، بلاغات). باقي الشاشات تبويبات جنبه: كل النصوص · الحسابات · الإعدادات.
 */
export default async function AqlamInboxPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const [review, guardianRequests, reports] = await Promise.all([
    listAdminPosts(['pending_review']),
    listPendingGuardianRequests(),
    listOpenReports(),
  ]);

  // أسماء الكتّاب والمبلّغ عنهم وأولياء الأمور — استعلام واحد بدل رقم لكل صف.
  const labels = await labelUsers([
    ...review.map((p) => p.writerId),
    ...guardianRequests.map((g) => g.guardianId),
    ...reports.flatMap((r) => (r.writerId ? [r.writerId] : [])),
  ]);
  const edits = await listPostEdits(review.map((p) => p.id));

  const cards = [
    { href: '#review', label: 'بانتظار المراجعة', n: review.length },
    { href: '#guardian-requests', label: 'طلبات أولياء الأمور', n: guardianRequests.length },
    { href: '#reports', label: 'بلاغات مفتوحة', n: reports.length },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة — الصندوق" />

      <ul className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <a
              href={c.href}
              className={`block rounded-3xl border p-5 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                c.n > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="block text-3xl font-black text-slate-900">{c.n.toLocaleString('ar-EG')}</span>
              <span className="text-sm font-bold text-slate-600">{c.label}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* ── المراجعة ── */}
      <section aria-labelledby="review" className="space-y-4">
        <Heading id="review">بانتظار المراجعة ({review.length.toLocaleString('ar-EG')})</Heading>
        {review.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">مفيش نصوص بتستنى.</p>
        ) : (
          <ul className="space-y-4">
            {review.map((p) => (
              <li key={p.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</h3>
                  <p className="text-xs font-medium text-slate-500">
                    {p.displayName} · {p.ageGroup === 'under_12' ? 'أقل من ١٢' : '١٢+'} · {formatDate(p.createdAt)}
                  </p>
                  <p className="text-xs">
                    الكاتب: <Person id={p.writerId} labels={labels} />
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                  {p.body}
                </div>
                <PostEdits edits={edits.get(p.id)} />
                <ActionForm action={moderatePost} className="space-y-3">
                  <input type="hidden" name="postId" value={p.id} />
                  <Field label="السبب (للرفض)" name="reason">
                    <TextInput name="reason" maxLength={300} />
                  </Field>
                  <FormActions>
                    <DecisionButton name="decision" value="reject" variant="secondary" accentColor="enhaLak" pendingLabel="جارٍ الرفض…">
                      رفض
                    </DecisionButton>
                    <DecisionButton name="decision" value="approve" accentColor="journey" pendingLabel="جارٍ النشر…">
                      نشر
                    </DecisionButton>
                  </FormActions>
                </ActionForm>
                <SanctionBox userId={p.writerId} label={who(p.writerId, labels).name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── طلبات أولياء الأمور ── */}
      <section aria-labelledby="guardian-requests" className="space-y-4">
        <Heading id="guardian-requests">
          طلبات قفل التعليقات ({guardianRequests.length.toLocaleString('ar-EG')})
        </Heading>
        <p className="text-sm font-medium text-slate-500">
          ولي الأمر بيطلب قفل التعليقات لابنه ويكتب السبب. الموافقة بتقفلها فورًا (استقبالًا وكتابةً)، والرفض لازم
          يتكتب له سببه. القرار بيوصله في إشعار.
        </p>
        {guardianRequests.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">مفيش طلبات.</p>
        ) : (
          <ul className="space-y-4">
            {guardianRequests.map((g) => (
              <li key={g.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold text-slate-500">
                  {g.childName ? `الابن: ${g.childName}` : 'ابن'} · {formatDate(g.createdAt)}
                </p>
                <p className="text-xs">
                  ولي الأمر: <Person id={g.guardianId} labels={labels} />
                </p>
                <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">
                  {g.reason}
                </p>
                <ActionForm action={decideGuardianRequest} className="space-y-3">
                  <input type="hidden" name="requestId" value={g.id} />
                  <Field label="ملاحظة لولي الأمر" name="note" hint="إجبارية لو هترفض، واختيارية مع الموافقة.">
                    <TextArea name="note" rows={2} maxLength={500} />
                  </Field>
                  <FormActions>
                    <DecisionButton name="decision" value="reject" variant="secondary" accentColor="enhaLak" pendingLabel="جارٍ الرفض…">
                      رفض
                    </DecisionButton>
                    <DecisionButton name="decision" value="approve" accentColor="journey" pendingLabel="جارٍ الموافقة…">
                      موافقة وقفل التعليقات
                    </DecisionButton>
                  </FormActions>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── البلاغات ── */}
      <section aria-labelledby="reports" className="space-y-4">
        <Heading id="reports">بلاغات مفتوحة ({reports.length.toLocaleString('ar-EG')})</Heading>
        {reports.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">مفيش بلاغات.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => (
              <li key={r.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold text-slate-500">
                  {r.targetType === 'post' ? 'نص' : 'تعليق'} · {REASON_LABELS[r.reason] ?? r.reason} · {formatDate(r.createdAt)}
                  {r.targetStatus && ` · حالته: ${postStatusLabel(r.targetStatus).label}`}
                </p>
                <p className="text-sm font-medium whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{r.preview}</p>
                {r.details && <p className="text-sm font-medium text-slate-500">«{r.details}»</p>}
                {r.writerId && (
                  <p className="text-xs">
                    {r.targetType === 'post' ? 'الكاتب' : 'كاتب التعليق'}: <Person id={r.writerId} labels={labels} />
                  </p>
                )}
                {r.postId && (
                  <Link href={`/aqlam/p/${r.postId}`} className="text-sm font-bold text-slate-900 underline underline-offset-4">
                    افتح النص
                  </Link>
                )}
                {r.writerId && <SanctionBox userId={r.writerId} label={who(r.writerId, labels).name} />}
                <ActionForm action={handleReport}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <FormActions>
                    <DecisionButton name="decision" value="dismissed" variant="secondary" pendingLabel="جارٍ الحفظ…">
                      تجاهل
                    </DecisionButton>
                    <DecisionButton name="decision" value="actioned" pendingLabel="جارٍ الحفظ…">
                      تم التعامل
                    </DecisionButton>
                  </FormActions>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
