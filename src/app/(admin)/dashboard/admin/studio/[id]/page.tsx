import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { StatusBadge } from '@/components/StatusBadge';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getStudioProject, getStudioStages, getStudioTasks, listStudioStaff } from '@/data/domains/(admin)/studio/queries';
import { DeadlineChip } from '@/components/admin/DeadlineChip';
import { moveStudioProject } from '@/actions/studio';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { isUuid } from '@/lib/studio';
import {
  flowBlockers,
  flowCanMove,
  flowMoves,
  flowNext,
  flowSkipTargets,
  flowPipeline,
  flowStep,
  isTerminalIn,
  ownerLabelOf,
  statusLabel,
  statusTone,
  type FlowMove,
  type StudioFlow,
} from '@/lib/studio-flow';
import { BriefPanel, CharacterPanel, CostsPanel, PagesPanel, QaPanel, TextPanel } from './panels';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'brief', label: 'الطلب والمواصفات' },
  { id: 'text', label: 'النص' },
  { id: 'character', label: 'الشخصية' },
  { id: 'pages', label: 'الصفحات' },
  { id: 'qa', label: 'الجودة' },
  { id: 'costs', label: 'التكلفة' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** التبويب المناسب لمرحلة المشروع — بيفتح عليه لو مفيش اختيار. */
function defaultTab(flow: StudioFlow, status: string): TabId {
  if (status === 'character') return 'character';
  if (status === 'qa' || status === 'ready') return 'qa';
  const abilities = flowStep(flow, status)?.abilities ?? [];
  if (abilities.includes('text')) return 'text';
  if (abilities.includes('pages')) return 'pages';
  return 'brief';
}

/** أسماء الأزرار للمراحل الأصلية؛ المضافة بتاخد اسمًا عامًا من اسم المرحلة. */
const MOVE_LABELS: Partial<Record<string, string>> = {
  text_draft: 'ابدأ كتابة النص',
  text_review: 'أرسل للمراجعة',
  client_text_approval: 'أرسل للعميل',
  character: 'ابدأ الشخصية',
  scenes: 'ابدأ المشاهد',
  art_review: 'أرسل لمراجعة الرسوم',
  layout: 'ابدأ التركيب',
  qa: 'ابدأ فحص الجودة',
  ready: 'جاهز للتسليم',
  delivered: 'تم التسليم',
};

export default async function StudioProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canWorkStudio')) return <Unauthorized />;
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const canManage = hasAdminPermission(user, 'canManageStudio');
  const canCosts = canManage || hasAdminPermission(user, 'canManageFinance');
  const canOrders = hasAdminPermission(user, 'canManageOrders');

  const [result, staff, sp, stages, tasks] = await Promise.all([
    getStudioProject(id),
    canManage ? listStudioStaff() : Promise.resolve([]),
    searchParams,
    getStudioStages(),
    getStudioTasks(),
  ]);
  const label = (v: string) => statusLabel(v, stages.labels);
  if (!result.success) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <DashboardPageHeader title="مشروع قصة" backHref="/dashboard/admin/studio" />
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900">
          {result.error.message}
        </p>
      </div>
    );
  }
  if (!result.data) notFound();
  const { project, versions, pages, costs } = result.data;

  const visibleTabs = TABS.filter((t) => t.id !== 'costs' || canCosts);
  const tab: TabId = visibleTabs.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : defaultTab(stages.flow, project.status);

  const flow = stages.flow;
  const cur = flowStep(flow, project.status);
  const task = tasks.get(project.id);
  // صاحب المرحلة: المسند له المهمة، أو المحرر/المشرف المعيّن على المشروع لو المرحلة بتاعته.
  const isWorker =
    (task?.assigneeIds ?? []).includes(user.id) ||
    (cur?.ownerKind === 'editor' && project.editorId === user.id) ||
    (cur?.ownerKind === 'art_lead' && project.artLeadId === user.id);
  const actor = { canManage, isWorker };
  const moves = flowMoves(flow, project.status, project.heldFrom).filter((m) =>
    flowCanMove(actor, m, project.status, flow),
  );

  const pipeline = flowPipeline(flow);
  const placeKey = cur?.kind === 'hold' ? (project.heldFrom ?? '') : project.status;
  const stageIndex = pipeline.findIndex((s) => s.step === placeKey);
  const isForward = (m: FlowMove) => m.type === 'forward' || m.type === 'skip' || m.type === 'resume';
  const ordered = [...moves.filter(isForward), ...moves.filter((m) => !isForward(m))];
  const moveLabel = (m: FlowMove) => {
    if (m.type === 'resume') return `استئناف (${label(m.to)})`;
    if (m.type === 'hold') return 'إيقاف مؤقت';
    if (m.type === 'cancel') return 'إلغاء المشروع';
    if (m.type === 'forward') return MOVE_LABELS[m.to] ?? `انقل إلى «${label(m.to)}»`;
    if (m.type === 'skip') return `تخطّي إلى «${label(m.to)}»`;
    if (m.pagesRedo) return `تعديل النص (تعديل نطاق)`;
    const goingBack = (flowStep(flow, m.to)?.sortOrder ?? 0) < (cur?.sortOrder ?? 0);
    return goingBack ? `رجوع إلى «${label(m.to)}»` : `انتقال إلى «${label(m.to)}»`;
  };
  const ctx = {
    faceMode: project.faceMode,
    photoConsentAt: project.photoConsentAt,
    characterApprovedAt: project.characterApprovedAt,
    sensitiveTopic: project.sensitiveTopic,
    qaChecklist: project.qaChecklist,
    versions,
    pages,
  };

  const owner = ownerLabelOf(flow, project.status);
  const nextKey = flowNext(flow, project.status);
  const writing = !!cur?.abilities.includes('text');
  const art = !!cur?.abilities.includes('pages');
  // لو موافقة العميل شرط في مرحلة جاية (حتى لو بالتخطّي) فتسجيلها متاح من المرحلة دي.
  const clientStage = [nextKey, ...flowSkipTargets(flow, project.status)].some(
    (k) => !!k && !!flowStep(flow, k)?.gates.includes('text_client_approved'),
  );
  const terminal = isTerminalIn(flow, project.status);
  const title = project.childName ? `قصة ${project.childName}` : 'قصة مخصّصة';

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title={title} backHref="/dashboard/admin/studio" />

      {/* الحالة */}
      <section aria-label="حالة المشروع" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={label(project.status)} type={statusTone(project.status, flow)} />
          {!terminal && cur?.kind !== 'hold' && (
            <span className="text-xs font-medium text-slate-500">المرحلة عند: {owner}</span>
          )}
          {cur?.kind === 'hold' && project.heldFrom && (
            <span className="text-xs font-medium text-slate-500">كان في: {label(project.heldFrom)}</span>
          )}
          {task && !terminal && (
            <Link href={`/dashboard/admin/tasks/${task.id}`} aria-label="تفاصيل مهمة المرحلة وتاريخها">
              <DeadlineChip d={task.deadline} dueAt={task.dueAt} />
            </Link>
          )}
          {project.dueAt && (
            <span className="text-xs font-bold text-slate-500">تسليم المشروع: {formatDate(project.dueAt)}</span>
          )}
          {canOrders && (
            <Link href={`/dashboard/admin/orders/${project.orderId}`} className="text-xs font-bold text-slate-600 underline">
              فتح الطلب
            </Link>
          )}
        </div>

        {stages.hints[project.status] && !terminal && (
          <p className="rounded-2xl bg-slate-50 p-3 text-xs font-medium leading-6 text-slate-600">
            {stages.hints[project.status]}
          </p>
        )}

        {stageIndex >= 0 && (
          <ol className="flex flex-wrap gap-1.5" aria-label="مراحل الإنتاج">
            {pipeline.map((st, i) => (
              <li
                key={st.step}
                aria-current={i === stageIndex ? 'step' : undefined}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  i < stageIndex
                    ? 'bg-emerald-100 text-emerald-900'
                    : i === stageIndex
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {label(st.step)}
              </li>
            ))}
          </ol>
        )}

        {project.orderClosed && !terminal && (
          <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-900">
            الطلب اتلغى أو اتردّ فلوسه والمشروع لسه شغّال. راجع مسؤول الإنتاج وقرّر: إلغاء المشروع أو إيقافه.
          </p>
        )}

        {project.status === 'delivered' && (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
            اتسلّم {project.deliveredAt ? formatDate(project.deliveredAt) : ''}
            {project.deliveryNote ? ` — ${project.deliveryNote}` : ''}
          </p>
        )}

        {moves.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {ordered.map((m) => {
              const to = m.to;
              const blockers = flowBlockers(flow, to, ctx, m.skipGates);
              const fwd = isForward(m);
              const noteKind = flowStep(flow, to)?.kind;
              return (
                <div key={to} className="space-y-2">
                  <ActionForm
                    action={moveStudioProject}
                    successMessage="اتحرّك المشروع."
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="to" value={to} />
                    {(noteKind === 'done' || noteKind === 'hold' || noteKind === 'cancel') && (
                      <div className="min-w-[14rem] flex-1">
                        <Field label={noteKind === 'done' ? 'ملاحظة التسليم' : 'السبب'} name="note">
                          <TextInput name="note" maxLength={1000} />
                        </Field>
                      </div>
                    )}
                    <DecisionButton
                      variant={fwd ? 'primary' : 'secondary'}
                      disabled={blockers.length > 0}
                      pendingLabel="جارٍ التنفيذ…"
                    >
                      {moveLabel(m)}
                    </DecisionButton>
                  </ActionForm>
                  {blockers.length > 0 && (
                    <ul className="list-disc pr-5 text-xs font-bold text-amber-800">
                      {blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div role="tablist" aria-label="أقسام المشروع" className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            href={`/dashboard/admin/studio/${project.id}?tab=${t.id}`}
            className={`min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'brief' && (
          <BriefPanel
            project={project}
            staff={staff}
            canManage={canManage}
            orderHref={canOrders ? `/dashboard/admin/orders/${project.orderId}` : null}
          />
        )}
        {tab === 'text' && (
          <TextPanel project={project} versions={versions} writing={writing} clientStage={clientStage} />
        )}
        {tab === 'character' && <CharacterPanel project={project} />}
        {tab === 'pages' && <PagesPanel project={project} pages={pages} canManage={canManage} art={art} />}
        {tab === 'qa' && <QaPanel project={project} canManage={canManage} />}
        {tab === 'costs' && canCosts && <CostsPanel project={project} costs={costs} />}
      </div>
    </div>
  );
}
