import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  getAdminPeople,
  getRecentTaskEvents,
  getTaskSteps,
  getWorkTasks,
  runTaskDeadlineSweep,
} from '@/data/domains/(admin)/tasks/queries';
import { hasAdminPermission } from '@/lib/utils';
import { TasksClient } from './TasksClient';

export const dynamic = 'force-dynamic';

/**
 * «مهامي» للموظف، و«متابعة المهام» للمدير العام وحامل «توزيع المهام» (ملف 14 + مواعيد).
 *
 * المدير العام مالوش مهام مسندة — شغله المتابعة: فين كل طلب، عند مين، من إمتى، وإيه
 * اللي فات موعده. فالشاشة بتفتح له على «نظرة شاملة» مش على «المسندة ليا».
 *
 * المهام بتتعمل لوحدها مع حالة الطلب، وبتتوزّع حسب «توزيع الطلبات»، وكل مهمة ليها موعد من
 * كتالوج المراحل. أول ما أي إداري يفتح الصفحة بيتشغّل فحص المواعيد (مقيّد بمرة كل ١٠ دقايق).
 */
export default async function Page() {
  const user = await getCurrentUser();
  // أي إداري — حتى اللي صلاحيته الحجوزات بس (الحماية في القاعدة: `is_admin()`).
  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') return <Unauthorized />;

  const canAssign = hasAdminPermission(user, 'canAssignWork');
  const isManager = user.role === 'super_admin' || canAssign;

  // الفحص قبل القراءة: لو فيه إشعار هيتبعت يبقى حالة الصفحة متسقة معاه.
  await runTaskDeadlineSweep();

  const [tasks, people, steps, events] = await Promise.all([
    getWorkTasks(),
    getAdminPeople(),
    getTaskSteps(),
    isManager ? getRecentTaskEvents(25) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title={isManager ? 'متابعة المهام' : 'مهامي'}
        action={canAssign ? { label: 'المراحل والمواعيد', href: '/dashboard/admin/tasks/steps' } : undefined}
      />
      {tasks === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          «مهامي» محتاجة ملف القاعدة 14 يتشغّل الأول.
        </p>
      ) : (
        <>
          {steps === null && (
            <p role="status" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              المواعيد والمراحل الدقيقة لسه مش شغّالة — محتاجة تطبيق migration «مواعيد المهام» على قاعدة البيانات.{' '}
              <Link href="/dashboard/admin/tasks/steps" className="underline">
                التفاصيل
              </Link>
            </p>
          )}
          <TasksClient
            tasks={tasks}
            people={people}
            steps={steps ?? []}
            events={events}
            me={user.id}
            isManager={isManager}
            canAssign={canAssign}
          />
        </>
      )}
    </div>
  );
}
