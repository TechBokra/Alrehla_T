import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { PostCard } from '@/components/aqlam/PostCard';
import { getAqlamConfig } from '@/data/domains/(shared)/aqlam/config';
import { getPublicWriter, listPublicWriterPosts } from '@/data/domains/(shared)/aqlam/queries';
import { ageBandById } from '@/lib/age-bands';
import { pageMetadata } from '@/lib/seo';
import { requireAqlamReadable } from '../../gate';

/**
 * صفحة كاتب **اختار** يظهر (اختيارية ومن ١٢ سنة فأكبر). الرابط عشوائي ومش
 * رقم الحساب. مش بتتفهرس أبدًا (نصوص الكاتب نفسها بتتفهرس لو سمح، لكن
 * التجميع تحت اسمه لأ). بتتخزّن دقيقة زي صفحة النص.
 */
export const revalidate = 60;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await requireAqlamReadable();
  const { slug } = await params;
  const [writer, cfg] = await Promise.all([getPublicWriter(slug), getAqlamConfig()]);
  if (!writer || !cfg.features.writerPages) return { title: 'الصفحة غير موجودة', robots: { index: false, follow: false } };
  const meta = await pageMetadata({
    title: `${writer.name} · أقلام الرحلة`,
    description: writer.bio || `نصوص ${writer.name} في أقلام الرحلة`,
    path: `/aqlam/w/${slug}`,
    noIndex: true,
  });
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function WriterPage({ params }: { params: Params }) {
  await requireAqlamReadable();
  const { slug } = await params;
  const [writer, cfg] = await Promise.all([getPublicWriter(slug), getAqlamConfig()]);
  // الإدارة قفلت صفحات الكتّاب العامة ← كأنها مش موجودة.
  if (!writer || !cfg.features.writerPages) notFound();
  const posts = await listPublicWriterPosts(slug);
  const band = writer.ageBand ? ageBandById(writer.ageBand) : null;

  return (
    <PageContainer>
      <Section containerClassName="max-w-5xl space-y-8">
        <Link
          href="/aqlam"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          كل النصوص
        </Link>

        <header className="space-y-3 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 text-center md:p-10">
          {band && (
            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${band.tone.chip}`}>
              {band.label}
            </span>
          )}
          <h1 className="text-3xl font-black text-slate-900 [overflow-wrap:anywhere] md:text-5xl">{writer.name}</h1>
          {writer.bio && (
            <p className="mx-auto max-w-xl text-base leading-loose font-medium whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere]">
              {writer.bio}
            </p>
          )}
          <p className="text-sm font-bold text-slate-500">{writer.postsCount.toLocaleString('ar-EG')} نص منشور</p>
        </header>

        {posts.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-8 text-center font-bold text-slate-500">مفيش نصوص منشورة لسه.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} cfg={cfg} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageContainer>
  );
}
