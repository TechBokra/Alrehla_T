import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, FormActions, Select, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { listAdminPosts, listOpenReports } from '@/data/domains/(shared)/aqlam/admin';
import { handleReport, moderatePost, sanctionUser, saveAqlamSettings } from '@/actions/aqlam';
import { REPORT_REASONS } from '@/lib/aqlam/post';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { hasAdminPermission, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));

const MODE_OPTIONS = [
  { value: 'off', label: 'مقفول (إيقاف طارئ — محدش يقدر يتفاعل)' },
  { value: 'pilot', label: 'تجريبي (بالرابط فقط، والنشر لقايمة محددة)' },
  { value: 'public', label: 'عام (ظاهر في القائمة ومفهرس بإذن الكاتب)' },
] as const;

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-black text-slate-800">
      {children}
    </h2>
  );
}

export default async function AqlamAdminPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const [settings, review, reports, live] = await Promise.all([
    getSiteSettings(),
    listAdminPosts(['pending_review']),
    listOpenReports(),
    listAdminPosts(['published', 'hidden'], 30),
  ]);
  const aqlam = settings.aqlam;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة" />

      {/* ── التشغيل ── */}
      <section aria-labelledby="mode" className="space-y-4">
        <Heading id="mode">التشغيل</Heading>
        <ActionForm action={saveAqlamSettings} successMessage="اتحفظت الإعدادات." className="space-y-6">
          <Field label="الحالة" name="mode" required>
            <Select name="mode" defaultValue={aqlam.mode}>
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="قايمة التجربة (أرقام الحسابات)"
            name="allowlist"
            hint="رقم الحساب الكامل، واحد في كل سطر. بتشتغل في الوضع التجريبي فقط. المسؤولون مسموح لهم دايمًا."
          >
            <TextArea name="allowlist" rows={4} defaultValue={aqlam.allowlist.join('\n')} dir="ltr" />
          </Field>
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

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
                </div>
                <div className="max-h-72 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                  {p.body}
                </div>
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
                {r.postId && (
                  <Link href={`/aqlam/p/${r.postId}`} className="text-sm font-bold text-slate-900 underline underline-offset-4">
                    افتح النص
                  </Link>
                )}
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

      {/* ── المنشور ── */}
      <section aria-labelledby="live" className="space-y-4">
        <Heading id="live">المنشور والمخفي (آخر ٣٠)</Heading>
        <ul className="space-y-3">
          {live.map((p) => {
            const st = postStatusLabel(p.status);
            return (
              <li key={p.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/aqlam/p/${p.id}`} className="font-black text-slate-900 underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                    {p.title}
                  </Link>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-xs font-medium text-slate-500" dir="ltr">
                  {p.displayName} · writer: {p.writerId}
                </p>
                <ActionForm action={moderatePost} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="postId" value={p.id} />
                  {p.status === 'published' ? (
                    <DecisionButton name="decision" value="hide" variant="secondary" pendingLabel="جارٍ…">
                      إخفاء
                    </DecisionButton>
                  ) : (
                    <DecisionButton name="decision" value="restore" variant="secondary" pendingLabel="جارٍ…">
                      استرجاع
                    </DecisionButton>
                  )}
                  {p.status === 'published' && (
                    <DecisionButton name="decision" value={p.featured ? 'unfeature' : 'feature'} variant="secondary" pendingLabel="جارٍ…">
                      {p.featured ? 'شيل التمييز' : 'تمييز'}
                    </DecisionButton>
                  )}
                  <DecisionButton name="decision" value="remove" variant="secondary" accentColor="enhaLak" pendingLabel="جارٍ…">
                    إزالة
                  </DecisionButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── العقوبات ── */}
      <section aria-labelledby="sanction" className="space-y-4">
        <Heading id="sanction">عقوبة على حساب</Heading>
        <ActionForm action={sanctionUser} successMessage="اتسجّلت العقوبة." className="space-y-6">
          <Field label="رقم الحساب" name="userId" required>
            <TextInput name="userId" dir="ltr" required />
          </Field>
          <Field label="النوع" name="kind" required>
            <Select name="kind" defaultValue="warning">
              <option value="warning">تحذير</option>
              <option value="suspension_7d">إيقاف ٧ أيام</option>
              <option value="permanent">إيقاف دائم</option>
            </Select>
          </Field>
          <Field label="السبب" name="reason" required>
            <TextInput name="reason" maxLength={500} required />
          </Field>
          <FormActions>
            <SubmitButton>تسجيل العقوبة</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>
    </div>
  );
}
