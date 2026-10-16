import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BookOpen, Heart, MessageCircle, Pencil } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getStudentDocuments } from '@/data/domains/(shared)/portfolio/queries';
import {
  getMyAqlamStatus,
  getMyWriterProfile,
  listMyPosts,
  type MyPostRow,
} from '@/data/domains/(shared)/aqlam/mine';
import { categoryLabel } from '@/lib/aqlam/post';
import { editedMessage, postStatusLabel, postedMessage } from '@/lib/aqlam/status-labels';
import { formatDate } from '@/lib/utils';
import { requireAqlamReadable } from '../gate';
import { ProfileForm } from './ProfileForm';
import { RemoveButton } from './RemoveButton';

export const metadata: Metadata = {
  title: 'ملفي · أقلام الرحلة',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

type Tab = 'posts' | 'drafts' | 'profile';
const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: 'منشوراتي' },
  { key: 'drafts', label: 'مسوداتي' },
  { key: 'profile', label: 'بياناتي' },
];

const linkBtn =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none';

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; posted?: string; edited?: string }>;
}) {
  await requireAqlamReadable();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'posts';

  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in?next=/aqlam/me');

  const [posts, status, profile, documents] = await Promise.all([
    listMyPosts(user.id),
    getMyAqlamStatus(),
    getMyWriterProfile(user.id),
    tab === 'drafts'
      ? getStudentDocuments(user.id)
      : Promise.resolve([] as Awaited<ReturnType<typeof getStudentDocuments>>),
  ]);

  const banner = postedMessage(sp.posted) ?? editedMessage(sp.edited);
  const displayName = profile.penName || status?.fullName || user.fullName || 'كاتب';
  const published = posts.filter((p) => p.status === 'published');
  const totals = published.reduce(
    (acc, p) => ({ reactions: acc.reactions + p.reactionCount, comments: acc.comments + p.commentCount }),
    { reactions: 0, comments: 0 },
  );

  const publicAllowed = !!status && status.ageGroup === '12_plus' && !status.needsBirthdate && !status.suspended;
  const publicBlockedReason = !status
    ? 'تعذّر تحميل حالتك. جرّب تاني بعد شوية.'
    : status.suspended
      ? 'حسابك موقوف عن أقلام الرحلة حاليًا.'
      : status.needsBirthdate
        ? 'هنطلب تاريخ ميلادك مع أول نص تنشره، وبعدها تقدر تفعّل صفحتك.'
        : 'الصفحة العامة متاحة من ١٢ سنة فأكبر.';

  // مسودة اتنشرت قبل كده؟ نص ما اتشالش بيشاور عليها.
  const postByDoc = new Map<string, MyPostRow>();
  for (const p of posts) {
    if (p.sourceDocumentId && !postByDoc.has(p.sourceDocumentId)) postByDoc.set(p.sourceDocumentId, p);
  }

  return (
    <PageContainer>
      <Section containerClassName="max-w-3xl space-y-6">
        <header className="space-y-4 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-500">ملفي في أقلام الرحلة</p>
              <h1 className="text-3xl font-black text-slate-900 [overflow-wrap:anywhere] md:text-4xl">{displayName}</h1>
              {profile.bio && (
                <p className="mt-2 max-w-xl text-sm leading-loose font-medium whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere]">
                  {profile.bio}
                </p>
              )}
            </div>
            <Link
              href="/aqlam/publish"
              className="inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              نص جديد
            </Link>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <dd>{published.length.toLocaleString('ar-EG')}</dd>
              <dt className="font-medium text-slate-500">منشور</dt>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-400" aria-hidden="true" />
              <dd>{totals.reactions.toLocaleString('ar-EG')}</dd>
              <dt className="font-medium text-slate-500">تشجيع</dt>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <dd>{totals.comments.toLocaleString('ar-EG')}</dd>
              <dt className="font-medium text-slate-500">تعليق</dt>
            </div>
          </dl>
        </header>

        {banner && (
          <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {banner}
          </p>
        )}

        <nav aria-label="أقسام ملفي" className="flex gap-1 rounded-full bg-slate-100 p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'posts' ? '/aqlam/me' : `/aqlam/me?tab=${t.key}`}
              aria-current={t.key === tab ? 'page' : undefined}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                t.key === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === 'posts' &&
          (posts.length === 0 ? (
            <Card accentColor="amber" className="space-y-4 p-10 text-center">
              <p className="font-bold text-slate-600">لسه ما نشرتش حاجة.</p>
              <Link href="/aqlam/me?tab=drafts" className={linkBtn}>
                شوف مسوداتك
              </Link>
            </Card>
          ) : (
            <ul className="space-y-4">
              {posts.map((p) => {
                const st = postStatusLabel(p.status);
                const editable = p.status !== 'hidden' && p.status !== 'removed';
                return (
                  <li key={p.id}>
                    <Card className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</h2>
                          <p className="text-xs font-medium text-slate-500">
                            {categoryLabel(p.category)} · {formatDate(p.publishedAt ?? p.createdAt)} · يظهر باسم{' '}
                            {p.displayName}
                            {p.editedAt && ` · عُدّل ${formatDate(p.editedAt)}`}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`}>{st.label}</span>
                      </div>
                      {st.help && <p className="text-sm font-medium text-slate-500">{st.help}</p>}
                      {p.status === 'published' && (
                        <p className="text-sm font-bold text-slate-600">
                          {p.reactionCount.toLocaleString('ar-EG')} تشجيع · {p.commentCount.toLocaleString('ar-EG')} تعليق
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                        {p.status === 'published' && (
                          <Link href={`/aqlam/p/${p.id}`} className={linkBtn}>
                            افتح النص
                          </Link>
                        )}
                        {editable && (
                          <Link href={`/aqlam/edit/${p.id}`} className={linkBtn}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            تعديل
                          </Link>
                        )}
                        <RemoveButton postId={p.id} />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === 'drafts' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-500">
              دي المستندات اللي كتبتها في{' '}
              <Link href="/account/writing" className="font-bold text-slate-900 underline underline-offset-4">
                مساحة الكتابة
              </Link>
              . اللي بتنشره هنا نسخة ثابتة؛ تعديل المستند بعد كده ما بيغيّرش المنشور إلا لما تحدّثه بنفسك.
            </p>
            {documents.length === 0 ? (
              <Card accentColor="amber" className="p-10 text-center">
                <p className="font-bold text-slate-600">مفيش مستندات في مساحة الكتابة لسه.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                {documents.slice(0, 50).map((d) => {
                  const post = postByDoc.get(d.id);
                  const changedSince =
                    !!post && new Date(d.updatedAt).getTime() > new Date(post.editedAt ?? post.createdAt).getTime();
                  return (
                    <li key={d.id}>
                      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <h2 className="font-black text-slate-900 [overflow-wrap:anywhere]">{d.title || 'من غير عنوان'}</h2>
                          <p className="text-xs font-medium text-slate-500">
                            آخر تعديل {formatDate(d.updatedAt)}
                            {post && ` · ${postStatusLabel(post.status).label}`}
                            {changedSince && ' · اتعدّل بعد النشر'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!post && (
                            <Link href={`/aqlam/publish?doc=${d.id}`} className={linkBtn}>
                              انشر
                            </Link>
                          )}
                          {post && changedSince && post.status !== 'hidden' && (
                            <Link href={`/aqlam/edit/${post.id}?doc=1`} className={linkBtn}>
                              حدّث المنشور
                            </Link>
                          )}
                          {post && (
                            <Link href={`/aqlam/edit/${post.id}`} className={linkBtn}>
                              افتح المنشور
                            </Link>
                          )}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <ProfileForm
            initial={profile}
            publicAllowed={publicAllowed}
            publicBlockedReason={publicBlockedReason}
          />
        )}
      </Section>
    </PageContainer>
  );
}
