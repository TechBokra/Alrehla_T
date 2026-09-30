import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getMyPublisher } from '@/data/domains/products';
import { LogoutButton } from '@/components/LogoutButton';
import { PublisherProfileClient } from './PublisherProfileClient';

export const dynamic = 'force-dynamic';

export default async function PublisherProfilePage() {
  const user = await getCurrentUser();

  // This page used to load `publishers[0]` — the first publisher in the whole
  // table — so a second publisher was shown, and would have edited, somebody
  // else's record.
  const publisher = await getMyPublisher();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="ملف الناشر" backHref="/dashboard/publisher" />

      {publisher ? (
        <PublisherProfileClient publisher={publisher} email={user.email} />
      ) : (
        <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          لم يتم ربط حسابك بدار نشر بعد. تواصل مع الإدارة.
        </p>
      )}

      <div className="mt-8 flex justify-end border-t border-slate-200 pt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
