import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { listMyPosts } from '@/data/domains/(shared)/aqlam/mine';
import { postStatusLabel, postedMessage } from '@/lib/aqlam/status-labels';
import { formatDate } from '@/lib/utils';
import { requireAqlamReadable } from '../gate';
import { RemoveButton } from './RemoveButton';

export const metadata: Metadata = {
  title: 'نصوصي · أقلام الرحلة',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function MinePage({ searchParams }: { searchParams: Promise<{ posted?: string }> }) {
  await requireAqlamReadable();
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in?next=/aqlam/mine');

  const posts = await listMyPosts(user.id);
  const banner = postedMessage(sp.posted);

  return (
    <PageContainer>
      <Section containerClassName="max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">نصوصي</h1>
          <Link
            href="/aqlam/publish"
            className="inline-flex min-h-[44px] items-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            نص جديد
          </Link>
        </header>

        {banner && (
          <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {banner}
          </p>
        )}

        {posts.length === 0 ? (
          <Card accentColor="amber" className="p-10 text-center">
            <p className="font-bold text-slate-600">لسه ما نشرتش حاجة.</p>
          </Card>
        ) : (
          <ul className="space-y-4">
            {posts.map((p) => {
              const st = postStatusLabel(p.status);
              return (
                <li key={p.id}>
                  <Card className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-900 [overflow-wrap:anywhere]">{p.title}</h2>
                        <p className="text-xs font-medium text-slate-500">
                          {formatDate(p.publishedAt ?? p.createdAt)} · يظهر باسم {p.displayName}
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
                        <Link
                          href={`/aqlam/p/${p.id}`}
                          className="inline-flex min-h-[44px] items-center text-sm font-bold text-slate-900 underline underline-offset-4"
                        >
                          افتح النص
                        </Link>
                      )}
                      <RemoveButton postId={p.id} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </PageContainer>
  );
}
