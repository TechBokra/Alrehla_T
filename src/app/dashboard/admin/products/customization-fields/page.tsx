import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { customizationAppliesToReady, getAllCustomizationFields } from '@/data/domains/customization-fields';
import { getManagedProducts } from '@/data/domains/products';
import { appliesToProducts } from '@/lib/applies-to';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { CustomizationFieldsClient } from './CustomizationFieldsClient';

export const dynamic = 'force-dynamic';

/** خانات التخصيص (ملف 06 — ملاحظة فريق العمل ٧، قرار تامر). */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const [fields, products, appliesToReady] = await Promise.all([
    getAllCustomizationFields(),
    // ⚠️ المنتجات لقايمة «يظهر فين» بس — لو وقعت، الخانات نفسها تفضل تتعدّل.
    getManagedProducts().catch(() => []),
    customizationAppliesToReady(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="خانات التخصيص" />
      <div className="mb-6 space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        <p>
          الخانات دي بتظهر للعميل في خطوة التخصيص — تحت الخانات الأساسية — في{' '}
          <strong>كل المنتجات</strong> (القصة المخصصة، وتخصيص غلاف المكتبة، وصندوق الرحلة)،
          أو في <strong>منتجات بعينها</strong> تختارها لكل خانة.
        </p>
        <p>
          الخانات الأساسية ثابتة ومش هنا: اسم الطفل، تاريخ الميلاد، صورته، والهدف ووصف
          البطل والإهداء وأسماء العائلة.
        </p>
        <p>
          إجابة العميل بتتحفظ في الطلب ومعاها اسم الخانة — فتغيير اسم خانة أو مسحها
          مابيبوّظش الطلبات القديمة.
        </p>
      </div>
      <CustomizationFieldsClient
        fields={fields}
        products={appliesToProducts(products)}
        appliesToReady={appliesToReady}
      />
    </div>
  );
}
