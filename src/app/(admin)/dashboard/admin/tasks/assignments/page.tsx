import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminPeople, getAssignmentRules } from '@/data/domains/(admin)/tasks/queries';
import { hasAdminPermission } from '@/lib/utils';
import { AssignmentsClient } from './AssignmentsClient';

export const dynamic = 'force-dynamic';

/** «توزيع الطلبات» (ملف 14) — مين مسؤول عن كل نوع وكل مرحلة. */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) return <Unauthorized />;

  const [rules, people] = await Promise.all([getAssignmentRules(), getAdminPeople()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="توزيع الطلبات" />
      <p className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium leading-relaxed text-blue-900">
        لكل نوع طلب ومرحلة اختار المسؤول (واحد أو أكتر). أول ما الطلب يوصل للمرحلة دي،
        بيتسند له تلقائيًا، وبيوصله إشعار، وبيظهر في «مهامي». ولو مفيش مسؤول، الطلب بيظهر
        في «من غير مسؤول» لكل الإدارة. التغيير هنا بيسري على الطلبات الجاية بس.
      </p>
      {rules === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          التوزيع محتاج ملف القاعدة 14 يتشغّل الأول.
        </p>
      ) : (
        <AssignmentsClient rules={rules} people={people} />
      )}
    </div>
  );
}
