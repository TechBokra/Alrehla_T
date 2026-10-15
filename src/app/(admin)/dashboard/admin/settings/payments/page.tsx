import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { FormError } from '@/components/ui/FormError';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission } from '@/lib/utils';
import { readPaymentSettingsForAdmin } from '@/actions/payments';
import { PaymentSettingsClient } from './PaymentSettingsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManagePayments')) return <Unauthorized />;

  const result = await readPaymentSettingsForAdmin();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="إعدادات الدفع" />
      <p className="mb-6 text-slate-600">
        كل إعدادات استقبال الفلوس في مكان واحد: بوابة الدفع، ورقم المحفظة اللي بتستقبل
        التحويلات. التبديل بين الاتنين فوري ومن غير نشر، فلو حصلت مشكلة في البوابة ارجع
        للتحويل اليدوي من هنا على طول. الطلبات القائمة ما بتتأثرش.
      </p>
      {result.ok ? (
        <PaymentSettingsClient
          settings={result.settings}
          gatewayConfigured={result.gatewayConfigured}
          walletNumber={result.walletNumber}
          qrUrl={result.qrUrl}
        />
      ) : (
        <FormError message={result.error} />
      )}
    </div>
  );
}
