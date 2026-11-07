import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getCertificates } from '@/data/domains/(shared)/certificates/queries';
import { hasAdminPermission } from '@/lib/utils';
import { CertificatesAdminClient } from './CertificatesAdminClient';

export const dynamic = 'force-dynamic';

/**
 * شهادات إتمام «بداية الرحلة» (٧ نوفمبر). الشهادة بتتعمل لوحدها لما المشارك
 * يخلّص كل جلسات باقته، أو يدويًا من صفحة الحجز. كل مرحلة مهمة في «مهامي».
 */
export default async function CertificatesPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) return <Unauthorized />;

  const certificates = await getCertificates({ all: true });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="شهادات الإتمام" backHref="/dashboard/admin/bookings" />
      <section className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-7 text-slate-700">
        <p>
          لما المشارك يخلّص كل جلسات باقته، الشهادة بتظهر هنا <strong>بانتظار الإصدار</strong> ومهمتها في «مهامي».
          راجع الاسم زي ما هيتطبع واصدرها — ولي الأمر بيوصله إشعار ويفتحها ويطبعها أو يحفظها PDF من حسابه.
        </p>
        <p>
          لو طلب نسخة ورقية، بتظهر بعنوانه في <strong>الطباعة</strong>، وبعدها الشحن والتسليم. المسؤولين والمهل من{' '}
          <Link href="/dashboard/admin/tasks/workflow?group=courses#track-certificates" className="font-bold text-blue-700 hover:underline">
            سير العمل والتوزيع
          </Link>
          .
        </p>
      </section>
      <CertificatesAdminClient certificates={certificates} />
    </div>
  );
}
