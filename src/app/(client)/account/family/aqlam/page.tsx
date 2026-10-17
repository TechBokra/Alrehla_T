import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, SubmitButton, TextArea } from '@/components/forms/Form';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { fetchFamilyMembers } from '@/app/actions/family';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import {
  listChildrenPosts,
  listGuardianSettings,
  listMyGuardianRequests,
  listPostsAwaitingGuardian,
} from '@/data/domains/(shared)/aqlam/mine';
import {
  cancelGuardianRequest,
  guardianDecideForm,
  reopenGuardianComments,
  requestCommentsLock,
  saveGuardianSettings,
} from '@/actions/aqlam';
import { AQLAM_LIMITS } from '@/lib/aqlam/post';
import { aqlamReadable } from '@/lib/aqlam/settings';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * أقلام الرحلة — مركز ولي الأمر: يوافق على نصوص أبنائه (أقل من ١٢) قبل
 * ما توصل للمراجعة، ويقفل النشر لكل ابن لوحده. قفل التعليقات بيتم بطلب
 * للإدارة مع السبب (فتحها تاني فوري).
 */
export default async function FamilyAqlamPage() {
  const settings = await getSiteSettings();
  if (!aqlamReadable(settings.aqlam)) notFound();

  const [children, awaiting, locks, requests] = await Promise.all([
    fetchFamilyMembers(),
    listPostsAwaitingGuardian(),
    listGuardianSettings(),
    listMyGuardianRequests(),
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
        لكل ابن، وتطلب من الإدارة قفل التعليقات وتكتب السبب.
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
              const req = requests[c.id];
              return (
                <li key={c.id} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="text-base font-black text-slate-900">{c.fullName}</h3>

                  <ActionForm action={saveGuardianSettings} successMessage="اتحفظت الإعدادات." className="space-y-4">
                    <input type="hidden" name="childId" value={c.id} />
                    <Checkbox name="publishingAllowed" defaultChecked={lock.publishingAllowed} label="يقدر ينشر نصوصه" />
                    <FormActions>
                      <SubmitButton>حفظ</SubmitButton>
                    </FormActions>
                  </ActionForm>

                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-black text-slate-800">التعليقات</h4>
                    {!lock.commentsAllowed ? (
                      <ActionForm action={reopenGuardianComments} successMessage="اتفتحت التعليقات." className="space-y-3">
                        <input type="hidden" name="childId" value={c.id} />
                        <p className="text-sm font-medium text-slate-600">
                          التعليقات مقفولة: مش هتظهر تعليقات على نصوصه ومش هيقدر يعلّق على نصوص غيره.
                        </p>
                        <FormActions>
                          <SubmitButton pendingLabel="جارٍ الفتح…">افتح التعليقات</SubmitButton>
                        </FormActions>
                      </ActionForm>
                    ) : req?.status === 'pending' ? (
                      <ActionForm action={cancelGuardianRequest} successMessage="اتسحب الطلب." className="space-y-3">
                        <input type="hidden" name="requestId" value={req.id} />
                        <p className="text-sm font-bold text-slate-700">
                          طلبك بيستنى قرار الإدارة ({formatDate(req.createdAt)}). هنبلّغك بالنتيجة.
                        </p>
                        <p className="rounded-2xl bg-slate-50 p-3 text-sm font-medium whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere]">
                          {req.reason}
                        </p>
                        <FormActions>
                          <DecisionButton
                            name="decision"
                            value="cancel"
                            variant="secondary"
                            accentColor="enhaLak"
                            pendingLabel="جارٍ السحب…"
                          >
                            اسحب الطلب
                          </DecisionButton>
                        </FormActions>
                      </ActionForm>
                    ) : (
                      <ActionForm action={requestCommentsLock} className="space-y-3">
                        <input type="hidden" name="childId" value={c.id} />
                        {req?.status === 'rejected' && (
                          <p role="status" className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
                            الإدارة رفضت طلبك السابق{req.adminNote ? `: ${req.adminNote}` : '.'}
                          </p>
                        )}
                        <p className="text-sm font-medium text-slate-600">
                          التعليقات مفتوحة. لو عايز تقفلها (استقبالًا وكتابةً)، ابعت طلب للإدارة واكتب السبب،
                          وهتقرر وتبلّغك.
                        </p>
                        <Field label="سبب الطلب" name="reason" required hint="الإدارة بتقراه، فاكتبه بوضوح.">
                          <TextArea
                            name="reason"
                            rows={3}
                            required
                            minLength={AQLAM_LIMITS.guardianReasonMin}
                            maxLength={AQLAM_LIMITS.guardianReasonMax}
                          />
                        </Field>
                        <FormActions>
                          <SubmitButton pendingLabel="جارٍ الإرسال…">ابعت الطلب للإدارة</SubmitButton>
                        </FormActions>
                      </ActionForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
