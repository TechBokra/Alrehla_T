import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { FormActions, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { findUsers, labelUsers, listSanctions, type AdminUserLabel } from '@/data/domains/(shared)/aqlam/admin';
import { liftSanction } from '@/actions/aqlam';
import { SanctionBox } from '../SanctionBox';
import { AllowlistButton, Heading, KIND_LABELS, Person } from '../_shared';
import { hasAdminPermission, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** أقلام الرحلة ← الحسابات: قايمة التجربة، البحث بالاسم/البريد والعقوبات، وسجل العقوبات. */
export default async function AqlamPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;
  const { q = '' } = await searchParams;
  const query = q.trim();

  const [settings, sanctions, found] = await Promise.all([
    getSiteSettings(),
    listSanctions(30),
    query.length >= 2 ? findUsers(query) : Promise.resolve([] as AdminUserLabel[]),
  ]);
  const aqlam = settings.aqlam;

  const labels = await labelUsers([...sanctions.map((s) => s.userId), ...aqlam.allowlist]);
  for (const f of found) labels.set(f.id, f);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة — الحسابات" />

      {/* ── الحسابات ── */}
      <section aria-labelledby="users" className="space-y-4">
        <Heading id="users">الحسابات</Heading>
        <p className="text-sm font-medium text-slate-500">
          ابحث بالاسم أو البريد الإلكتروني عشان توقّع عقوبة على حساب. (ومن أي نص أو بلاغ فوق تقدر تضغط «عقوبة» على كاتبه مباشرة.)
        </p>
        <form method="get" action="/dashboard/admin/aqlam/people#users" className="flex flex-wrap items-end gap-3">
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
