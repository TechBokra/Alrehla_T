import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { WorkflowEditor } from '@/components/admin/WorkflowEditor';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminPeople, getAssignmentRules, getTaskSteps } from '@/data/domains/(admin)/tasks/queries';
import { getStudioStages } from '@/data/domains/(admin)/studio/queries';
import { hasAdminPermission } from '@/lib/utils';
import { WORK_LINES, WORK_LINE_LABELS, isWorkLine, type WorkLine } from '@/lib/work-tasks';

export const dynamic = 'force-dynamic';

/**
 * «سير العمل والتوزيع» — مكان واحد لكل أنواع الطلبات (الاستوديو واحد منها، مش خط منفصل):
 * لكل نوع مراحله بالترتيب، ولكل مرحلة اسمها ومهلتها وشرحها ومسؤولوها، وللاستوديو كمان
 * قدرات المرحلة وشروط دخولها والانتقالات وإضافة/حذف المراحل.
 *
 * يدخلها: «توزيع المهام» (كل الأنواع) أو مسؤول إنتاج القصص (الاستوديو).
 */
export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const user = await getCurrentUser();
  const canAssign = hasAdminPermission(user, 'canAssignWork');
  const canStudio = hasAdminPermission(user, 'canManageStudio');
  if (!canAssign && !canStudio) return <Unauthorized />;

  const sp = await searchParams;
  const lines = WORK_LINES.filter((l) => (l === 'studio' ? canStudio || canAssign : canAssign));
  const line: WorkLine = isWorkLine(sp.line) && lines.includes(sp.line) ? sp.line : lines[0];

  const [people, rules, stages, catalog] = await Promise.all([
    getAdminPeople(),
    getAssignmentRules(),
    line === 'studio' ? getStudioStages() : Promise.resolve(null),
    line === 'studio' ? Promise.resolve(null) : getTaskSteps(line),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title="سير العمل والتوزيع" backHref="/dashboard/admin/tasks" />

      <section className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium leading-relaxed text-slate-700">
        <p>
          لكل نوع طلب مراحله بالترتيب. في كل مرحلة بتحدد: <strong>اسمها</strong> و<strong>مهلتها</strong> (منها موعد
          المهمة وإشعارات «قرب» و«فات»)، و<strong>المسؤولين عنها</strong> — أول ما الطلب يوصل للمرحلة بيتسند لهم
          تلقائيًا وبيوصلهم إشعار ويظهر في «مهامي».
        </p>
        <p>
          <strong>استوديو القصص</strong> جزء من نفس المنظومة: كل مرحلة فيه ليها مسؤولوها، وأي مسؤول بيدخل الاستوديو من
          غير دور مخصوص. وتقدر كمان تضيف مرحلة أو تحذفها أو ترتّبها وتضبط شروطها وانتقالاتها.
        </p>
        <p>
          التعديل بيسري على المهام <strong>اللي بتدخل المرحلة بعد الحفظ</strong>؛ المهام المفتوحة دلوقتي بتتحدّث بزرار
          «طبّق على المهام المفتوحة».
        </p>
      </section>

      <nav aria-label="أنواع الطلبات" className="flex flex-wrap gap-2">
        {lines.map((l) => (
          <Link
            key={l}
            href={`/dashboard/admin/tasks/workflow?line=${l}`}
            aria-current={l === line ? 'page' : undefined}
            className={`min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold ${
              l === line ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {WORK_LINE_LABELS[l]}
          </Link>
        ))}
      </nav>

      {rules === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          التوزيع محتاج ملف القاعدة 14 يتشغّل الأول.
        </p>
      ) : people.length === 0 ? (
        <p className="font-bold text-slate-700">مفيش حسابات إدارية لسه.</p>
      ) : line === 'studio' && stages ? (
        <WorkflowEditor
          line="studio"
          steps={stages.steps.map((s) => ({ ...s, line: 'studio' as const }))}
          flow={stages.flow}
          engine={stages.engine}
          canStructure={canStudio}
          rules={rules}
          people={people}
        />
      ) : catalog === null ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          محتاج تطبيق migration «مواعيد المهام» على قاعدة البيانات الأول.
        </p>
      ) : (
        <WorkflowEditor line={line} steps={catalog} rules={rules} people={people} />
      )}
    </div>
  );
}
