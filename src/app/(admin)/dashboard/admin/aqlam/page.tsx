import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, FormActions, Select, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import {
  findUsers,
  labelUsers,
  listAdminPosts,
  listOpenReports,
  listPendingGuardianRequests,
  listPostEdits,
  listSanctions,
  type AdminPostEdit,
  type AdminUserLabel,
} from '@/data/domains/(shared)/aqlam/admin';
import { decideGuardianRequest, handleReport, liftSanction, moderatePost, saveAqlamSettings, setAllowlistMember } from '@/actions/aqlam';
import { SanctionBox } from './SanctionBox';
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

const KIND_LABELS = {
  warning: 'تحذير',
  suspension_7d: 'إيقاف ٧ أيام',
  permanent: 'إيقاف دائم',
} as const;

/** الاسم والبريد بدل رقم الحساب. لو الاسم مش متاح بنرجع للرقم المختصر. */
function who(id: string | null, labels: Map<string, AdminUserLabel>): { name: string; email: string | null } {
  if (!id) return { name: 'حساب غير معروف', email: null };
  const l = labels.get(id);
  return { name: l?.fullName || `حساب ${id.slice(0, 8)}`, email: l?.email ?? null };
}

function Person({ id, labels }: { id: string | null; labels: Map<string, AdminUserLabel> }) {
  const { name, email } = who(id, labels);
  return (
    <span className="font-bold text-slate-700">
      {name}
      {email && (
        <span className="mx-1 font-medium text-slate-500" dir="ltr">
          {email}
        </span>
      )}
    </span>
  );
}

/** إضافة/شيل حساب من قايمة التجربة. */
function AllowlistButton({ userId, op }: { userId: string; op: 'add' | 'remove' }) {
  return (
    <ActionForm action={setAllowlistMember}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="op" value={op} />
      <FormActions>
        <SubmitButton pendingLabel="جارٍ الحفظ…">{op === 'add' ? 'أضف للقايمة' : 'شيل من القايمة'}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

/** النسخ القديمة قبل تعديل الكاتب (لو فيه). */
function PostEdits({ edits }: { edits: AdminPostEdit[] | undefined }) {
  if (!edits || edits.length === 0) return null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50">
      <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none">
        اتعدّل {edits.length.toLocaleString('ar-EG')} مرة · شوف النسخ القديمة
      </summary>
      <ul className="space-y-3 border-t border-slate-200 p-4">
        {edits.map((e) => (
          <li key={e.createdAt} className="space-y-1">
            <p className="text-xs font-bold text-slate-500">قبل تعديل {formatDate(e.createdAt)} · «{e.oldTitle}»</p>
            <div className="max-h-48 overflow-y-auto rounded-xl bg-white p-3 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
              {e.oldBody}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-black text-slate-800">
      {children}
    </h2>
  );
}

export default async function AqlamAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;
  const { q = '' } = await searchParams;
  const query = q.trim();

  const [settings, review, guardianRequests, reports, live, sanctions, found] = await Promise.all([
    getSiteSettings(),
    listAdminPosts(['pending_review']),
    listPendingGuardianRequests(),
    listOpenReports(),
    listAdminPosts(['published', 'hidden'], 30),
    listSanctions(30),
    query.length >= 2 ? findUsers(query) : Promise.resolve([] as AdminUserLabel[]),
  ]);
  const aqlam = settings.aqlam;

  // أسماء الكتّاب والمبلّغ عنهم والمعاقَبين — استعلام واحد بدل رقم لكل صف.
  const labels = await labelUsers([
    ...review.map((p) => p.writerId),
    ...guardianRequests.map((g) => g.guardianId),
    ...live.map((p) => p.writerId),
    ...reports.flatMap((r) => (r.writerId ? [r.writerId] : [])),
    ...sanctions.map((s) => s.userId),
    ...aqlam.allowlist,
  ]);
  for (const f of found) labels.set(f.id, f);
  const edits = await listPostEdits([...review.map((p) => p.id), ...live.map((p) => p.id)]);

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
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

      {/* ── قايمة التجربة ── */}
      <section aria-labelledby="allowlist" className="space-y-4">
        <Heading id="allowlist">قايمة التجربة ({aqlam.allowlist.length.toLocaleString('ar-EG')})</Heading>
        <p className="text-sm font-medium text-slate-500">
          الحسابات اللي تقدر تنشر وتتفاعل في الوضع «تجريبي» (المسؤولون مسموح لهم دايمًا). لإضافة حساب: ابحث عنه بالاسم
          أو البريد في «الحسابات» تحت واضغط «أضف للقايمة».
        </p>
        {aqlam.allowlist.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">القايمة فاضية.</p>
        ) : (
          <ul className="space-y-2">
            {aqlam.allowlist.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Person id={id} labels={labels} />
                <AllowlistButton userId={id} op="remove" />
              </li>
            ))}
          </ul>
        )}
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
                <p className="text-xs font-medium text-slate-500">
                  يظهر باسم {p.displayName} · الكاتب: <Person id={p.writerId} labels={labels} />
                </p>
                <PostEdits edits={edits.get(p.id)} />
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
                <SanctionBox userId={p.writerId} label={who(p.writerId, labels).name} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── الحسابات ── */}
      <section aria-labelledby="users" className="space-y-4">
        <Heading id="users">الحسابات</Heading>
        <p className="text-sm font-medium text-slate-500">
          ابحث بالاسم أو البريد الإلكتروني عشان توقّع عقوبة على حساب. (ومن أي نص أو بلاغ فوق تقدر تضغط «عقوبة» على كاتبه مباشرة.)
        </p>
        <form method="get" action="/dashboard/admin/aqlam#users" className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="aqlam-user-q" className="mb-1 block text-sm font-bold text-slate-700">
              الاسم أو البريد
            </label>
            <input
              id="aqlam-user-q"
              name="q"
              type="search"
              defaultValue={query}
              minLength={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            بحث
          </button>
        </form>
        {query.length === 1 && <p className="text-sm font-bold text-amber-800">اكتب حرفين على الأقل.</p>}
        {query.length >= 2 &&
          (found.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
              مفيش حساب بالبيانات دي. جرّب جزء من الاسم أو البريد.
            </p>
          ) : (
            <ul className="space-y-3">
              {found.map((u) => (
                <li key={u.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="font-black text-slate-900">
                    {u.fullName || 'من غير اسم'}
                    {u.email && (
                      <span className="mx-2 text-sm font-medium text-slate-500" dir="ltr">
                        {u.email}
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-medium text-slate-400" dir="ltr">
                    {u.id}
                  </p>
                  {!aqlam.allowlist.includes(u.id) ? (
                    <AllowlistButton userId={u.id} op="add" />
                  ) : (
                    <p className="text-sm font-bold text-emerald-700">في قايمة التجربة ✓</p>
                  )}
                  <SanctionBox userId={u.id} label={u.fullName || 'الحساب'} />
                </li>
              ))}
            </ul>
          ))}
      </section>

      {/* ── سجل العقوبات ── */}
      <section aria-labelledby="sanctions" className="space-y-4">
        <Heading id="sanctions">سجل العقوبات (آخر ٣٠)</Heading>
        {sanctions.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">مفيش عقوبات.</p>
        ) : (
          <ul className="space-y-3">
            {sanctions.map((s) => (
              <li key={s.id} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <Person id={s.userId} labels={labels} />
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      s.active
                        ? 'bg-rose-100 text-rose-900'
                        : s.liftedAt
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {KIND_LABELS[s.kind]}
                    {s.active ? ' · سارٍ' : s.liftedAt ? ' · اترفع' : s.kind === 'warning' ? '' : ' · انتهى'}
                  </span>
                </div>
                <p className="text-sm font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">{s.reason}</p>
                <p className="text-xs font-medium text-slate-500">
                  {formatDate(s.createdAt)}
                  {s.active && s.expiresAt && ` · بينتهي ${formatDate(s.expiresAt)}`}
                </p>
                {s.active && (
                  <ActionForm action={liftSanction} successMessage="اترفعت العقوبة.">
                    <input type="hidden" name="sanctionId" value={s.id} />
                    <FormActions>
                      <SubmitButton pendingLabel="جارٍ الرفع…">رفع العقوبة</SubmitButton>
                    </FormActions>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
