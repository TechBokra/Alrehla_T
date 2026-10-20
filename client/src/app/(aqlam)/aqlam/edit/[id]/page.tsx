import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDocumentById } from '@/data/domains/(shared)/portfolio/queries';
import { getAqlamConfig } from '@/data/domains/(shared)/aqlam/config';
import { getMyAqlamStatus, getMyPost } from '@/data/domains/(shared)/aqlam/mine';
import { aqlamErrorMessage } from '@/lib/aqlam/errors';
import { postStatusLabel } from '@/lib/aqlam/status-labels';
import { requireAqlamReadable } from '../../gate';
import { EditForm } from './EditForm';

export const metadata: Metadata = {
  title: 'تعديل نص · أقلام الرحلة',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-900">
      {children}
    </div>
  );
}

/** إيه اللي هيحصل للنص بعد الحفظ؟ (نفس منطق `aqlam_update_post` في القاعدة.) */
function warningFor(status: string, ageGroup: 'under_12' | '12_plus'): string | null {
  if (status === 'published' && ageGroup === 'under_12') {
    return 'بعد الحفظ النص هيتخبّى لحد ما ولي أمرك يوافق على النسخة الجديدة، وبعدها يتراجع من فريق الرحلة قبل ما يظهر تاني.';
  }
  if (status === 'published') return 'التعديل بيظهر فورًا، والنص هيتعلّم «عُدّل».';
  if (status === 'rejected') {
    return ageGroup === 'under_12'
      ? 'بعد الحفظ النص هيتبعت لولي أمرك من جديد.'
      : 'بعد الحفظ النص هيتبعت للمراجعة من جديد.';
  }
  return null;
}

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  await requireAqlamReadable();
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect(`/sign-in?next=${encodeURIComponent(`/aqlam/edit/${id}`)}`);

  const [post, status, cfg] = await Promise.all([getMyPost(user.id, id), getMyAqlamStatus(), getAqlamConfig()]);
  if (!post) notFound();

  let blocked: string | null = null;
  if (!status) blocked = aqlamErrorMessage(undefined);
  else if (!cfg.features.selfEdit) blocked = aqlamErrorMessage('editing_closed');
  else if (!status.enabled) blocked = aqlamErrorMessage('disabled');
  else if (status.suspended) blocked = aqlamErrorMessage('suspended');
  else if (status.publishingLocked) blocked = aqlamErrorMessage('guardian_locked');
  else if (post.status === 'hidden') blocked = aqlamErrorMessage('not_editable');

  // `?doc=1`: عبّي النموذج بآخر نسخة من المستند الأصلي (لازم يكون بتاعي).
  let title = post.title;
  let body = post.body;
  let fromDoc = false;
  if (sp.doc && post.sourceDocumentId) {
    const doc = await getDocumentById(post.sourceDocumentId);
    if (doc && doc.studentId === user.id) {
      title = doc.title || post.title;
      body = doc.content || post.body;
      fromDoc = true;
    }
  }

  const st = postStatusLabel(post.status);
  // التصنيفات المفعّلة + تصنيف النص الحالي لو اتعطّل (عشان يفضل مختار).
  const editCategories = cfg.categories
    .filter((c) => c.enabled || c.key === post.category)
    .map((c) => ({ key: c.key, label: c.label }));

  return (
    <PageContainer>
      <Section containerClassName="max-w-2xl space-y-6">
        <header className="space-y-2">
          <Link
            href="/aqlam/me"
            className="inline-flex min-h-[44px] items-center text-sm font-bold text-slate-500 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            ← ملفي
          </Link>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">تعديل النص</h1>
          <p className="text-sm font-bold text-slate-500">
            حالته دلوقتي: <span className={`rounded-full px-3 py-1 text-xs ${st.tone}`}>{st.label}</span>
          </p>
          {fromDoc && (
            <p className="text-sm font-medium text-slate-500">
              النموذج معبّى بآخر نسخة من مستندك. راجعها واحفظ لو عايز تحدّث المنشور.
            </p>
          )}
        </header>

        {blocked || !status ? (
          <Notice>{blocked}</Notice>
        ) : (
          <EditForm
            key={fromDoc ? 'doc' : 'post'}
            limits={{ titleMax: cfg.limits.titleMax, bodyMax: cfg.limits.bodyMax }}
            categories={editCategories}
            canIndex={cfg.features.googleIndexing}
            post={{
              id: post.id,
              title,
              body,
              category: post.category,
              allowIndexing: post.allowIndexing,
              commentsEnabled: post.commentsEnabled,
              displayName: post.displayName,
            }}
            ageGroup={post.ageGroup}
            warning={warningFor(post.status, post.ageGroup)}
          />
        )}
      </Section>
    </PageContainer>
  );
}
