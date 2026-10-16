import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { WorkflowEditor } from '@/components/admin/WorkflowEditor';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminPeople, getAssignmentRules, getTaskSteps } from '@/data/domains/(admin)/tasks/queries';
import { getStudioStages } from '@/data/domains/(admin)/studio/queries';
import { hasAdminPermission } from '@/lib/utils';
import {
  WORK_GROUPS,
  WORK_TRACK_LABELS,
  groupOfLine,
  isWorkGroup,
  isWorkLine,
  pathSteps,
  type WorkGroup,
  type WorkLine,
} from '@/lib/work-tasks';
import { flowPipeline } from '@/lib/studio-flow';

export const dynamic = 'force-dynamic';

/**
 * «سير العمل والتوزيع» — مكان واحد لكل المنظومات. «إنها لك» منظومة واحدة بثلاث مسارات: الطلب
 * (مكتبة وقصص) · إنتاج القصة المخصّصة (الاستوديو) · صندوق الرحلة؛ والاستوديو والصندوق مش عوالم
 * منفصلة — هما مراحل من رحلة نفس الطلب. جوّا كل مسار: مراحله ومهلها ومسؤولوها، وللاستوديو كمان
 * هيكله (إضافة/حذف/ترتيب وشروط وانتقالات).
 *
 * يدخلها: «توزيع المهام» (كل المسارات) أو مسؤول إنتاج القصص (مسار الاستوديو).
 */
export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; line?: string }>;
}) {
  const user = await getCurrentUser();
  const canAssign = hasAdminPermission(user, 'canAssignWork');
  const canStudio = hasAdminPermission(user, 'canManageStudio');
  if (!canAssign && !canStudio) return <Unauthorized />;

  const allowed = (l: WorkLine) => (l === 'studio' ? canStudio || canAssign : canAssign);
  const groups = WORK_GROUPS.filter((g) => g.lines.some(allowed));

  const sp = await searchParams;
  // الرابط القديم `?line=studio` بيفتح منظومته.
  const wanted: WorkGroup | null = isWorkGroup(sp.group) ? sp.group : isWorkLine(sp.line) ? groupOfLine(sp.line) : null;
  const group = groups.find((g) => g.id === wanted) ?? groups[0];
  const lines = group.lines.filter(allowed);

  const [people, rules, stages, catalog] = await Promise.all([
    getAdminPeople(),
    getAssignmentRules(),
    lines.includes('studio') ? getStudioStages() : Promise.resolve(null),
    getTaskSteps(),
  ]);

  // شريط الرحلة (قراءة فقط): مسار كل نوع بمراحله بالترتيب.
  const journey = lines.map((l) => {
    if (l === 'studio' && stages) {
      return { line: l, steps: flowPipeline(stages.flow).map((s) => s.label) };
    }
    return {
      line: l,
      steps: pathSteps(catalog ?? [], l).map((s) => s.label),
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title="سير العمل والتوزيع" backHref="/dashboard/admin/tasks" />

      <section className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium leading-relaxed text-slate-700">
        <p>
          كل منظومة ليها مسارات، وكل مسار ليه مراحله بالترتيب. في كل مرحلة بتحدد: <strong>اسمها</strong> و
          <strong>مهلتها</strong> (منها موعد المهمة وإشعارات «قرب» و«فات») و<strong>المسؤولين عنها</strong> — أول ما
          الطلب يوصلها بيتسند لهم تلقائيًا ويظهر في «مهامي».
        </p>
        <p>
          <strong>«إنها لك» منظومة واحدة:</strong> الطلب العادي (مكتبة وقصص)، وإنتاج القصة المخصّصة (الاستوديو)،
          وصندوق الرحلة. الاستوديو والصندوق مش منفصلين — هما مراحل من رحلة نفس الطلب، وكل مسار تتحكم فيه لوحده
          (مراحله ومسؤوليه ومهله، وللاستوديو كمان إضافة المراحل وشروطها).
        </p>
        <p>
          التعديل بيسري على المهام <strong>اللي بتدخل المرحلة بعد الحفظ</strong>؛ المفتوحة دلوقتي بتتحدّث بزرار «طبّق
          على المهام المفتوحة».
        </p>
      </section>

      <nav aria-label="المنظومات" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/dashboard/admin/tasks/workflow?group=${g.id}`}
            aria-current={g.id === group.id ? 'page' : undefined}
            className={`min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold ${
              g.id === group.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      {lines.length > 1 && (
        <section aria-labelledby="journey-h" className="space-y-3 rounded-3xl border border-blue-200 bg-blue-50/60 p-5">
          <h2 id="journey-h" className="text-base font-black text-blue-900">
            رحلة {group.label} — المسارات جنب بعض
          </h2>
          <ul className="space-y-2">
            {journey.map((j) => (
              <li key={j.line} className="text-sm">
                <a href={`#track-${j.line}`} className="font-black text-slate-900 hover:underline">
                  {WORK_TRACK_LABELS[j.line]}
                </a>
                <span className="mx-2 text-slate-400">:</span>
                <span className="font-medium text-slate-700">{j.steps.join(' ← ')}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium leading-6 text-slate-600">
            البند المخصّص في الطلب بيعدّي بمسار الاستوديو بالتوازي مع تجهيز الطلب وشحنه؛ حالته بتظهر لمدير الطلب في
            «رحلة الطلب».
          </p>
        </section>
      )}

      {rules === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          التوزيع محتاج ملف القاعدة 14 يتشغّل الأول.
        </p>
      ) : people.length === 0 ? (
        <p className="font-bold text-slate-700">مفيش حسابات إدارية لسه.</p>
      ) : (
        lines.map((l) => (
          <section key={l} id={`track-${l}`} aria-labelledby={`h-${l}`} className="scroll-mt-24 space-y-3">
            <h2 id={`h-${l}`} className="text-xl font-black text-slate-800">
              {lines.length > 1 ? WORK_TRACK_LABELS[l] : group.label}
            </h2>
            {l === 'studio' && stages ? (
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
              <WorkflowEditor line={l} steps={catalog.filter((s) => s.line === l)} rules={rules} people={people} />
            )}
          </section>
        ))
      )}
    </div>
  );
}
