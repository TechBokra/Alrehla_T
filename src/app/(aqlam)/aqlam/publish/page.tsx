import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDocumentById } from '@/data/domains/(shared)/portfolio/queries';
import { getMyAqlamStatus } from '@/data/domains/(shared)/aqlam/mine';
import { aqlamErrorMessage } from '@/lib/aqlam/errors';
import { requireAqlamReadable } from '../gate';
import { PublishForm } from './PublishForm';

export const metadata: Metadata = {
  title: 'انشر نصك · أقلام الرحلة',
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

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  await requireAqlamReadable();
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    const back = sp.doc ? `/aqlam/publish?doc=${encodeURIComponent(sp.doc)}` : '/aqlam/publish';
    redirect(`/sign-in?next=${encodeURIComponent(back)}`);
  }

  const status = await getMyAqlamStatus();

  // نص جاهز من مساحة الكتابة (لازم يكون بتاع الحساب نفسه).
  let initial: { title: string; body: string; docId: string } | null = null;
  if (sp.doc) {
    const doc = await getDocumentById(sp.doc);
    if (doc && doc.studentId === user.id) {
      initial = { title: doc.title, body: doc.content, docId: doc.id };
    }
  }

  let blocked: string | null = null;
  if (!status) blocked = aqlamErrorMessage(undefined);
  else if (!status.enabled) blocked = aqlamErrorMessage('disabled');
  else if (status.suspended) blocked = aqlamErrorMessage('suspended');
  else if (status.publishingLocked) blocked = aqlamErrorMessage('guardian_locked');

  return (
    <PageContainer>
      <Section containerClassName="max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">انشر نصك</h1>
          <p className="font-medium text-slate-500">
            اللي هتنشره نسخة من نصك. تقدر تعدّلها أو تشيلها في أي وقت من{' '}
            <Link href="/aqlam/me" className="font-bold text-slate-900 underline underline-offset-4">
              ملفي
            </Link>
            .
          </p>
        </header>

        {blocked || !status ? (
          <Notice>{blocked}</Notice>
        ) : (
          <PublishForm
            ageGroup={status.ageGroup}
            needsBirthdate={status.needsBirthdate}
            fullName={status.fullName}
            initial={initial}
          />
        )}
      </Section>
    </PageContainer>
  );
}
