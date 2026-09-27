import { getInstructorPayouts } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Wallet, ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { InstructorPayoutsClient } from './InstructorPayoutsClient';

export const dynamic = 'force-dynamic';

export default async function InstructorPayoutsPage() {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const payouts = await getInstructorPayouts();

  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-5xl flex-1 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/instructor" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-500">
              <ArrowRight className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-500" />
              المستحقات المالية
            </h1>
          </div>
        </div>

        <InstructorPayoutsClient payouts={payouts} />
      </div>
    </PageContainer>
  );
}
