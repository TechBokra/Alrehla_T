import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, TextInput } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { StatusBadge } from '@/components/StatusBadge';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getStudioProject, listStudioStaff } from '@/data/domains/(admin)/studio/queries';
import { moveStudioProject } from '@/actions/studio';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import {
  OWNER_LABELS,
  STATUS_LABELS,
  STUDIO_PIPELINE,
  canMove,
  isTerminal,
  isUuid,
  nextStatuses,
  stageOwner,
  statusLabel,
  statusTone,
  studioBlockers,
  type StudioStatus,
} from '@/lib/studio';
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
function defaultTab(status: StudioStatus): TabId {
  switch (status) {
    case 'text_draft':
    case 'text_review':
    case 'client_text_approval':
      return 'text';
    case 'character':
      return 'character';
    case 'scenes':
    case 'art_review':
    case 'layout':
      return 'pages';
    case 'qa':
    case 'ready':
      return 'qa';
    default:
      return 'brief';
  }
}

const MOVE_LABELS: Partial<Record<StudioStatus, string>> = {
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
  on_hold: 'إيقاف مؤقت',
  cancelled: 'إلغاء المشروع',
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

  const [result, staff, sp] = await Promise.all([getStudioProject(id), canManage ? listStudioStaff() : Promise.resolve([]), searchParams]);
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
  const tab: TabId = visibleTabs.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : defaultTab(project.status);

  const actor = { id: user.id, canManage, canWork: true };
  const pmProject = { status: project.status, editorId: project.editorId, artLeadId: project.artLeadId };
  const moves = nextStatuses(project.status, project.heldFrom).filter((to) => canMove(actor, pmProject, to));
  const stageIndex = STUDIO_PIPELINE.indexOf(
    project.status === 'on_hold' ? (project.heldFrom as StudioStatus) : project.status,
  );
  // «للأمام» = المرحلة التالية في الخط (أو الاستئناف من الإيقاف).
  const isForward = (to: StudioStatus) =>
    project.status === 'on_hold' || STUDIO_PIPELINE.indexOf(to) === stageIndex + 1;
  const forward = moves.filter(isForward);
  const sideways = moves.filter((to) => !isForward(to));
  const moveLabel = (to: StudioStatus) => {
    if (project.status === 'on_hold') return `استئناف (${statusLabel(to)})`;
    if (isForward(to)) return MOVE_LABELS[to] ?? statusLabel(to);
    if (to === 'on_hold' || to === 'cancelled') return MOVE_LABELS[to] ?? statusLabel(to);
    if (to === 'text_draft') return 'تعديل النص (تعديل نطاق)';
    return `رجوع إلى «${statusLabel(to)}»`;
  };
  const ctx = {
    from: project.status,
    faceMode: project.faceMode,
    photoConsentAt: project.photoConsentAt,
    characterApprovedAt: project.characterApprovedAt,
    sensitiveTopic: project.sensitiveTopic,
    qaChecklist: project.qaChecklist,
    versions,
    pages,
  };

  const owner = OWNER_LABELS[stageOwner(project.status)];
  const title = project.childName ? `قصة ${project.childName}` : 'قصة مخصّصة';

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title={title} backHref="/dashboard/admin/studio" />

      {/* الحالة */}
      <section aria-label="حالة المشروع" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={statusLabel(project.status)} type={statusTone(project.status)} />
          {!isTerminal(project.status) && project.status !== 'on_hold' && (
            <span className="text-xs font-medium text-slate-500">المرحلة عند: {owner}</span>
          )}
          {project.status === 'on_hold' && project.heldFrom && (
            <span className="text-xs font-medium text-slate-500">كان في: {statusLabel(project.heldFrom)}</span>
          )}
          {project.dueAt && <span className="text-xs font-bold text-slate-500">الموعد: {formatDate(project.dueAt)}</span>}
          {canOrders && (
            <Link href={`/dashboard/admin/orders/${project.orderId}`} className="text-xs font-bold text-slate-600 underline">
              فتح الطلب
            </Link>
          )}
        </div>

        {stageIndex >= 0 && (
          <ol className="flex flex-wrap gap-1.5" aria-label="مراحل الإنتاج">
            {STUDIO_PIPELINE.map((s, i) => (
              <li
                key={s}
                aria-current={i === stageIndex ? 'step' : undefined}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  i < stageIndex
                    ? 'bg-emerald-100 text-emerald-900'
                    : i === stageIndex
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
        )}

        {project.orderClosed && !isTerminal(project.status) && (
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
            {[...forward, ...sideways].map((to) => {
              const blockers = studioBlockers(to, ctx);
              const fwd = isForward(to);
              return (
                <div key={to} className="space-y-2">
                  <ActionForm
                    action={moveStudioProject}
                    successMessage="اتحرّك المشروع."
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="to" value={to} />
                    {(to === 'delivered' || to === 'on_hold' || to === 'cancelled') && (
                      <div className="min-w-[14rem] flex-1">
                        <Field label={to === 'delivered' ? 'ملاحظة التسليم' : 'السبب'} name="note">
                          <TextInput name="note" maxLength={1000} />
                        </Field>
                      </div>
                    )}
                    <DecisionButton
                      variant={fwd ? 'primary' : 'secondary'}
                      disabled={blockers.length > 0}
                      pendingLabel="جارٍ التنفيذ…"
                    >
                      {moveLabel(to)}
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
        {tab === 'text' && <TextPanel project={project} versions={versions} />}
        {tab === 'character' && <CharacterPanel project={project} />}
        {tab === 'pages' && <PagesPanel project={project} pages={pages} canManage={canManage} />}
        {tab === 'qa' && <QaPanel project={project} canManage={canManage} />}
        {tab === 'costs' && canCosts && <CostsPanel project={project} costs={costs} />}
      </div>
    </div>
  );
}
