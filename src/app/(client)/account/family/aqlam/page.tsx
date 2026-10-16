import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, FormActions, SubmitButton } from '@/components/forms/Form';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { fetchFamilyMembers } from '@/app/actions/family';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import {
  listChildrenPosts,
  listGuardianSettings,
  listPostsAwaitingGuardian,
} from '@/data/domains/(shared)/aqlam/mine';
import { guardianDecideForm, saveGuardianSettings } from '@/actions/aqlam';
import { aqlamReadable } from '@/lib/aqlam/settings';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * أقلام الرحلة — مركز ولي الأمر: يوافق على نصوص أبنائه (أقل من ١٢) قبل
 * ما توصل للمراجعة، ويقفل النشر/التعليق لكل ابن لوحده.
 */
export default async function FamilyAqlamPage() {
  const settings = await getSiteSettings();
  if (!aqlamReadable(settings.aqlam)) notFound();

  const [children, awaiting, locks] = await Promise.all([
    fetchFamilyMembers(),
    listPostsAwaitingGuardian(),
    listGuardianSettings(),
  ]);
  // كل نصوص الأبناء (مش بس اللي مستنية قرار): حساب كل ابن هو اللي بيربطه بنصوصه.
  const childByAccount = new Map(
    children.flatMap((c) => (c.accountProfileId ? [[c.accountProfileId, c.fullName] as const] : [])),
  );
  const allPosts = await listChildrenPosts(Array.from(childByAccount.keys()));

  return (
    <div className="space-y-8">
      <DashboardPageHeader title="أقلام الرحلة" backHref="/account/family" />
      <p className="text-sm font-medium text-slate-500">
        نصوص أبنائك الأصغر من ١٢ سنة بتستنى موافقتك قبل ما تروح لمراجعة فريق الرحلة. ولو محتاج، تقدر تقفل النشر
        أو التعليق لكل ابن.
      </p>

      <section aria-labelledby="awaiting" className="space-y-4">
        <h2 id="awaiting" className="text-lg font-black text-slate-800">
          بانتظار موافقتك
        </h2>
        {awaiting.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
            مفيش نصوص بتستنى.
          </p>
        ) : (
          <ul className="space-y-4">
            {awaiting.map((p) => (
              <li key={p.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</h3>
                  <p className="text-xs font-medium text-slate-500">
                    {p.displayName} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                  {p.body}
                </div>
                <ActionForm action={guardianDecideForm} successHref="/account/family/aqlam">
                  <input type="hidden" name="postId" value={p.id} />
                  <FormActions>
                    <DecisionButton
                      name="decision"
                      value="reject"
                      variant="secondary"
                      accentColor="enhaLak"
                      pendingLabel="جارٍ الرفض…"
                    >
                      رفض
                    </DecisionButton>
                    <DecisionButton
                      name="decision"
                      value="approve"
                      accentColor="journey"
                      pendingLabel="جارٍ الموافقة…"
                    >
                      موافقة
                    </DecisionButton>
                  </FormActions>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="all-posts" className="space-y-4">
        <h2 id="all-posts" className="text-lg font-black text-slate-800">
          كل نصوص أبنائك
        </h2>
        {allPosts.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
            لسه ما نشروش حاجة.
          </p>
        ) : (
          <ul className="space-y-3">
            {allPosts.map((p) => {
              const st = postStatusLabel(p.status);
              return (
                <li key={p.id} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</h3>
                      <p className="text-xs font-medium text-slate-500">
                        {childByAccount.get(p.writerId) ?? 'ابنك'} · {formatDate(p.publishedAt ?? p.createdAt)}
                        {p.editedAt && ` · عُدّل ${formatDate(p.editedAt)}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`}>{st.label}</span>
                  </div>
                  {p.status === 'published' && (
                    <p className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-600">
                      <span>
                        {p.reactionCount.toLocaleString('ar-EG')} تشجيع · {p.commentCount.toLocaleString('ar-EG')} تعليق
                      </span>
                      <Link
                        href={`/aqlam/p/${p.id}`}
                        className="inline-flex min-h-[44px] items-center text-slate-900 underline underline-offset-4"
                      >
                        افتح النص
                      </Link>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="locks" className="space-y-4">
        <h2 id="locks" className="text-lg font-black text-slate-800">
          إعدادات كل ابن
        </h2>
        {children.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
            لسه ما أضفتش أفراد للعائلة.
          </p>
        ) : (
          <ul className="space-y-4">
            {children.map((c) => {
              const lock = locks[c.id] ?? { publishingAllowed: true, commentsAllowed: true };
              return (
                <li key={c.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <ActionForm
                    action={saveGuardianSettings}
                    successMessage="اتحفظت الإعدادات."
                    className="space-y-4"
                  >
                    <input type="hidden" name="childId" value={c.id} />
                    <h3 className="text-base font-black text-slate-900">{c.fullName}</h3>
                    <Checkbox
                      name="publishingAllowed"
                      defaultChecked={lock.publishingAllowed}
                      label="يقدر ينشر نصوصه"
                    />
                    <Checkbox
                      name="commentsAllowed"
                      defaultChecked={lock.commentsAllowed}
                      label="يقدر يستقبل ويكتب تعليقات"
                      hint="لو قفلتها، مش هتظهر تعليقات على نصوصه ومش هيقدر يعلّق على نصوص غيره."
                    />
                    <FormActions>
                      <SubmitButton>حفظ</SubmitButton>
                    </FormActions>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
