import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getProvidersForAdmin, getProviderCandidates } from '@/data/domains/providers';
import { getStandaloneServices } from '@/data/domains/services';
import { getPricingFormulaSettings } from '@/data/domains/writing';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { ProvidersClient } from './ProvidersClient';

export const dynamic = 'force-dynamic';

/**
 * مقدّمو الخدمة: المنصة والمدربون والمستقلون.
 *
 * الشاشة دي هي المكان الوحيد اللي بيتحدد منه مين بيقدّم أي خدمة وبكام،
 * ومنها بيتفعّل مقدّم الخدمة أو يتوقف.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) {
    return <Unauthorized />;
  }

  const [providers, services, formula, candidates] = await Promise.all([
    getProvidersForAdmin(),
    getStandaloneServices({ includeInactive: true }),
    getPricingFormulaSettings(),
    getProviderCandidates(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <DashboardPageHeader title="مقدّمو الخدمة" />

      <p className="mb-8 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
        «منصة الرحلة» مقدّم خدمة زي أي حد — بتظهر للعميل بعلامة «فريق المنصة».
        المدرب بيبقى له صف تلقائيًا. المقدّم المستقل بيتضاف من هنا ويظهر في قايمة
        الاختيار بس، من غير صفحة عامة.
      </p>

      <ProvidersClient
        providers={providers}
        services={services.map((s) => ({ id: s.id, name: s.name, price: s.price }))}
        platformMultiplier={formula?.platformMultiplier ?? null}
        fixedAdminFee={formula?.fixedAdminFee ?? null}
        candidates={candidates}
      />
    </div>
  );
}
