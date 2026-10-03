import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { byDisplayOrder, getManagedProducts } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { HeroOrderClient } from './HeroOrderClient';

export const dynamic = 'force-dynamic';

/**
 * ترتيب منتجات «أنت البطل هنا» (ملف 06 — ملاحظة فريق العمل ٨).
 *
 * القايمة هنا بنفس ترتيب الموقع بالظبط (`byDisplayOrder` — نفس الدالة
 * اللي الصفحة العامة بتستعملها)، فاللي تشوفه هنا هو اللي العميل بيشوفه.
 * والموقوف وغير المعتمد بيظهروا كمان (باهتين) عشان مكانهم يتحدد قبل ما
 * يرجعوا للعرض.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  // `getManagedProducts` بترجّع الأحدث أولًا، والترتيب الثابت بيحافظ عليه
  // بين المتساويين — نفس منطق الموقع.
  const products = (await getManagedProducts())
    .filter((p) => p.category === 'custom')
    .sort(byDisplayOrder)
    .map((p) => ({
      id: p.id,
      name: p.name,
      coverImageUrl: p.coverImageUrl ?? null,
      visible: p.isActive && p.reviewStatus === 'approved',
    }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="ترتيب «أنت البطل هنا»" backHref="/dashboard/admin/products" />
      <p className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        حرّك المنتج بالأسهم — الترتيب بيتحفظ مع كل ضغطة وبيظهر على الموقع على
        طول. المنتج الجديد بيظهر أول القايمة لحد ما ترتّبه.
      </p>
      <HeroOrderClient products={products} />
    </div>
  );
}
