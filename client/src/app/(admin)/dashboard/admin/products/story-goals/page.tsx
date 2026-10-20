import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAllStoryGoals } from '@/data/domains/(admin)/products/story-goals';
import { getManagedProducts } from '@/data/domains/(shared)/products/queries';
import { appliesToProducts } from '@/lib/applies-to';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { StoryGoalsClient } from './StoryGoalsClient';

export const dynamic = 'force-dynamic';

/** أهداف التخصيص (ملف 12) — كانت أربعة ثابتين في الكود. */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const [{ goals, needsFile12 }, products] = await Promise.all([
    getAllStoryGoals(),
    // ⚠️ المنتجات لقايمة «يظهر فين» بس — لو وقعت، الأهداف نفسها تفضل تتعدّل.
    getManagedProducts().catch(() => []),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <DashboardPageHeader title="أهداف التخصيص" />
      <div className="mb-6 space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
        <p>
          العميل بيختار <strong>هدف واحد</strong> للقصة في خطوة «تفاصيل القصة» — من القايمة دي.
          وفي اشتراك صندوق الرحلة بتظهر كاقتراحات لهدف كل شهر.
        </p>
        <p>
          اختيار <strong>«هدف آخر — أكتبه بنفسي»</strong> موجود دايمًا في آخر القايمة، مش هنا.
        </p>
        <p>
          كل هدف ممكن يظهر في كل المنتجات أو في منتجات بعينها. والطلبات القديمة بتفضل حافظة نص
          الهدف اللي اتختار وقتها — فتغيير هدف أو مسحه مابيبوّظش حاجة.
        </p>
      </div>
      {needsFile12 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-900">
          الشاشة دي محتاجة ملف 12 — لحد ما يتشغّل العميل بيشوف الأربعة أهداف القدام.
        </p>
      ) : (
        <StoryGoalsClient goals={goals} products={appliesToProducts(products)} />
      )}
    </div>
  );
}
