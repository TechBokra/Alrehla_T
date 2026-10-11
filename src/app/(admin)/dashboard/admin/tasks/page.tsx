import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getAdminPeople, getWorkTasks } from '@/data/domains/work-tasks';
import { TasksClient } from './TasksClient';

export const dynamic = 'force-dynamic';

/**
 * «مهامي» (ملف 14) — المطلوب من كل إداري: مراجعة دفع، أو تنفيذ طلب.
 * المهام بتتعمل لوحدها مع حالة الطلب، وبتتوزّع حسب «توزيع الطلبات».
 */
export default async function Page() {
  const user = await getCurrentUser();
  // أي إداري — حتى اللي صلاحيته الحجوزات بس (الحماية في القاعدة: `is_admin()`).
  if (user.role !== 'super_admin' && user.role !== 'general_supervisor') return <Unauthorized />;

  const [tasks, people] = await Promise.all([getWorkTasks(), getAdminPeople()]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="مهامي" />
      {tasks === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          «مهامي» محتاجة ملف القاعدة 14 يتشغّل الأول.
        </p>
      ) : (
        <TasksClient tasks={tasks} people={people} me={user.id} />
      )}
    </div>
  );
}
