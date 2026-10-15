import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { TaskStepsEditor } from '@/components/admin/TaskStepsEditor';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getTaskSteps } from '@/data/domains/(admin)/tasks/queries';
import { hasAdminPermission } from '@/lib/utils';
import { WORK_LINES, WORK_LINE_LABELS } from '@/lib/work-tasks';

export const dynamic = 'force-dynamic';

/**
 * «المراحل والمواعيد» — لكل نوع: مراحله بالتفصيل، واسم كل مرحلة، وكم ساعة المهلة. كل مهمة بتاخد موعدها
 * من مهلة المرحلة اللي دخلتها، والنظام بيبعت إشعار لما الموعد يقرب ولما يفوت.
 * مراحل الاستوديو بتتدار من «إعدادات الاستوديو» (ليها صاحب وتبويب).
 */
export default async function TaskStepsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canAssignWork')) return <Unauthorized />;
  const catalog = await getTaskSteps();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-6 py-12">
      <DashboardPageHeader title="المراحل والمواعيد" backHref="/dashboard/admin/tasks" />

      <section className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium leading-relaxed text-slate-700">
        <p>
          كل مهمة بتتفتح بموعد = <strong>المهلة (بالساعات)</strong> اللي هنا للمرحلة اللي دخلتها. لما المهمة تنتقل
          لمرحلة تانية (مثلًا الطلب من «بانتظار التجهيز» لـ«قيد التجهيز») الموعد بيتحسب من جديد.
        </p>
        <p>
          <strong>الإشعارات:</strong> «قرب الموعد» لما يتبقى ٢٥٪ من المهلة (وبحد أدنى ساعتين) — للمسؤول، ولو من غير
          مسؤول للمديرين. «فات الموعد» للمسؤول والمديرين. كل إشعار مرة واحدة لكل مرحلة.
        </p>
        <p>
          التعديل هنا بيأثر على المهام اللي <strong>بتدخل المرحلة بعد كده</strong>. المهمة المفتوحة دلوقتي موعدها
          بيتعدّل من صفحة تفاصيلها.
        </p>
      </section>

      {catalog === null ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          محتاج تطبيق migration «مواعيد المهام» على قاعدة البيانات الأول.
        </p>
      ) : (
        <>
          {WORK_LINES.filter((l) => l !== 'studio').map((l) => (
            <section key={l} aria-labelledby={`l-${l}`} className="space-y-3">
              <h2 id={`l-${l}`} className="text-xl font-black text-slate-800">
                {WORK_LINE_LABELS[l]}
              </h2>
              <TaskStepsEditor line={l} steps={catalog.filter((s) => s.line === l)} />
            </section>
          ))}

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-black text-slate-800">{WORK_LINE_LABELS.studio}</h2>
            <p className="mt-2 text-sm font-medium text-slate-600">
              مراحل الاستوديو (الاسم والمهلة وصاحب المرحلة وظهور التبويب) بتتدار من إعداداته.
            </p>
            <Link
              href="/dashboard/admin/studio/settings#stages"
              className="mt-3 inline-block font-bold text-blue-800 underline underline-offset-4"
            >
              مراحل الاستوديو
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
