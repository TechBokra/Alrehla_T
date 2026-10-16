import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { QueryResult } from '@/data/query-result';
import type { Json } from '@/types/supabase';
import {
  DEFAULT_FLOW,
  buildFlow,
  isAbility,
  isGateKey,
  isStageKind,
  type FlowEdge,
  type FlowStep,
  type StageOwnerKind,
  type StudioFlow,
} from '@/lib/studio-flow';
import { getTaskSteps } from '@/data/domains/(admin)/tasks/queries';
import { deadlineState, type DeadlineState, type TaskStep } from '@/lib/work-tasks';

/**
 * قراءة استوديو القصص (لوحة الإدارة بس).
 *
 * - أعمدة محدّدة وحدّ أقصى للصفوف: قائمة المشاريع ماتسحبش النصوص ولا الـ brief.
 * - التكلفة بتتقرا لمن عنده صلاحيتها بس (RLS في القاعدة بترجّع صفر صفوف لغيره).
 * - مفيش صورة طفل هنا: الـ brief من غير `childPhoto` أصلًا.
 */

const LIST_LIMIT = 200;

/** الجداول لسه ماتعملتش في القاعدة (الـ migration ماتطبّقش) — رسالة تقول السبب بدل «تعذّر». */
const NOT_SET_UP = 'الاستوديو لسه مش مفعّل في قاعدة البيانات — لازم تطبيق migration استوديو القصص أولًا.';

function isMissingRelation(code: string | null | undefined): boolean {
  return code === 'PGRST205' || code === '42P01';
}

export async function getStudioMode(): Promise<'off' | 'on'> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle();
  if (error) {
    console.error('getStudioMode', error.message);
    return 'off';
  }
  const v = (data?.value ?? {}) as { studioMode?: unknown };
  return v.studioMode === 'on' ? 'on' : 'off';
}

export type StudioProjectRow = {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  status: string;
  ageBand: string | null;
  pageTarget: number | null;
  faceMode: 'cartoon' | 'real';
  sensitiveTopic: boolean;
  editorId: string | null;
  artLeadId: string | null;
  dueAt: string | null;
  childName: string | null;
  /** الموعد فات والمشروع لسه شغّال (محسوبة هنا مش في الشاشة). */
  overdue: boolean;
  /** الطلب اتلغى/اتردّ والمشروع لسه شغّال — محتاج قرار. */
  orderClosed: boolean;
  createdAt: string;
  updatedAt: string;
};

function briefChildName(brief: Json): string | null {
  if (brief && typeof brief === 'object' && !Array.isArray(brief)) {
    const b = brief as Record<string, Json | undefined>;
    for (const k of ['childName', 'child_name', 'name']) {
      const v = b[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
    }
  }
  return null;
}

export async function listStudioProjects(): Promise<QueryResult<StudioProjectRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_projects')
    .select(
      'id, order_id, order_item_id, product_id, status, age_band, page_target, face_mode, sensitive_topic, editor_id, art_lead_id, due_at, order_closed_at, brief, created_at, updated_at',
    )
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) {
    console.error('listStudioProjects', error.message);
    return {
      success: false,
      error: { code: error.code ?? 'unknown', message: isMissingRelation(error.code) ? NOT_SET_UP : 'تعذّر تحميل المشاريع.' },
    };
  }
  const now = Date.now();
  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      orderItemId: r.order_item_id,
      productId: r.product_id,
      status: r.status,
      ageBand: r.age_band,
      pageTarget: r.page_target,
      faceMode: r.face_mode === 'real' ? 'real' : 'cartoon',
      sensitiveTopic: r.sensitive_topic,
      editorId: r.editor_id,
      artLeadId: r.art_lead_id,
      dueAt: r.due_at,
      childName: briefChildName(r.brief),
      orderClosed: r.order_closed_at !== null,
      overdue:
        !!r.due_at &&
        r.status !== 'delivered' &&
        r.status !== 'cancelled' &&
        new Date(r.due_at).getTime() < now,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export type StudioProjectDetail = StudioProjectRow & {
  heldFrom: string | null;
  brief: Record<string, unknown>;
  photoConsentAt: string | null;
  photoConsentNote: string | null;
  characterNotes: string | null;
  characterRefUrl: string | null;
  characterApprovedAt: string | null;
  qaChecklist: Record<string, boolean>;
  qaPassedAt: string | null;
  deliveredAt: string | null;
  deliveryNote: string | null;
};

export type StudioVersion = {
  id: string;
  versionNo: number;
  body: string;
  source: 'ai' | 'editor';
  status: string;
  note: string | null;
  createdAt: string;
  approvedAt: string | null;
  clientDecisionAt: string | null;
  clientDecisionNote: string | null;
};

export type StudioPage = {
  id: string;
  pageNo: number;
  pageText: string;
  sceneDescription: string;
  imageUrl: string | null;
  status: string;
  attempts: number;
  reviewerNote: string | null;
};

export type StudioCost = {
  id: string;
  kind: string;
  amount: number;
  minutes: number | null;
  note: string | null;
  createdAt: string;
};

export type StudioProjectBundle = {
  project: StudioProjectDetail;
  versions: StudioVersion[];
  pages: StudioPage[];
  costs: StudioCost[];
};

function asObject(v: Json): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asChecklist(v: Json): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(asObject(v))) out[k] = val === true;
  return out;
}

export async function getStudioProject(id: string): Promise<QueryResult<StudioProjectBundle | null>> {
  const supabase = await createClient();
  const [p, v, pg, c] = await Promise.all([
    supabase
      .from('story_projects')
      .select(
        'id, order_id, order_item_id, product_id, status, held_from, brief, age_band, page_target, face_mode, photo_consent_at, photo_consent_note, sensitive_topic, editor_id, art_lead_id, due_at, order_closed_at, character_notes, character_ref_url, character_approved_at, qa_checklist, qa_passed_at, delivered_at, delivery_note, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('story_versions')
      .select('id, version_no, body, source, status, note, created_at, approved_at, client_decision_at, client_decision_note')
      .eq('project_id', id)
      .order('version_no', { ascending: false })
      .limit(50),
    supabase
      .from('story_pages')
      .select('id, page_no, page_text, scene_description, image_url, status, attempts, reviewer_note')
      .eq('project_id', id)
      .order('page_no', { ascending: true })
      .limit(100),
    supabase
      .from('story_cost_entries')
      .select('id, kind, amount, minutes, note, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const failure = p.error ?? v.error ?? pg.error;
  if (failure) {
    console.error('getStudioProject', failure.message);
    return {
      success: false,
      error: { code: failure.code ?? 'unknown', message: isMissingRelation(failure.code) ? NOT_SET_UP : 'تعذّر تحميل المشروع.' },
    };
  }
  const r = p.data;
  if (!r) return { success: true, data: null };

  // التكلفة: لو الصلاحية مش موجودة القاعدة بترجّع صفر صفوف — مش خطأ.
  if (c.error) console.error('getStudioProject costs', c.error.message);

  const brief = asObject(r.brief);
  return {
    success: true,
    data: {
      project: {
        id: r.id,
        orderId: r.order_id,
        orderItemId: r.order_item_id,
        productId: r.product_id,
        status: r.status,
        heldFrom: r.held_from,
        brief,
        ageBand: r.age_band,
        pageTarget: r.page_target,
        faceMode: r.face_mode === 'real' ? 'real' : 'cartoon',
        photoConsentAt: r.photo_consent_at,
        photoConsentNote: r.photo_consent_note,
        sensitiveTopic: r.sensitive_topic,
        editorId: r.editor_id,
        artLeadId: r.art_lead_id,
        dueAt: r.due_at,
        characterNotes: r.character_notes,
        characterRefUrl: r.character_ref_url,
        characterApprovedAt: r.character_approved_at,
        qaChecklist: asChecklist(r.qa_checklist),
        qaPassedAt: r.qa_passed_at,
        deliveredAt: r.delivered_at,
        deliveryNote: r.delivery_note,
        childName: briefChildName(r.brief),
        overdue: false,
        orderClosed: r.order_closed_at !== null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      versions: (v.data ?? []).map((x) => ({
        id: x.id,
        versionNo: x.version_no,
        body: x.body,
        source: x.source === 'ai' ? 'ai' : 'editor',
        status: x.status,
        note: x.note,
        createdAt: x.created_at,
        approvedAt: x.approved_at,
        clientDecisionAt: x.client_decision_at,
        clientDecisionNote: x.client_decision_note,
      })),
      pages: (pg.data ?? []).map((x) => ({
        id: x.id,
        pageNo: x.page_no,
        pageText: x.page_text,
        sceneDescription: x.scene_description,
        imageUrl: x.image_url,
        status: x.status,
        attempts: x.attempts,
        reviewerNote: x.reviewer_note,
      })),
      costs: (c.data ?? []).map((x) => ({
        id: x.id,
        kind: x.kind,
        amount: Number(x.amount),
        minutes: x.minutes,
        note: x.note,
        createdAt: x.created_at,
      })),
    },
  };
}

export type StudioStaff = { id: string; name: string };

/**
 * موظفو الاستوديو اللي ينفع يتعيّنوا على مشروع: أي حساب دوره الإداري فيه صلاحية
 * استوديو، + المسؤولون عن مرحلة استوديو في «توزيع المهام»، + مديرو النظام. لو الصلاحيات
 * منعت القراءة بتتحول لقايمة فاضية والشاشة بتقول كده بدل ما تخمّن.
 */
export async function listStudioStaff(): Promise<StudioStaff[]> {
  const supabase = await createClient();
  const [rolesRes, rulesRes] = await Promise.all([
    supabase.from('admin_roles').select('id, permissions'),
    supabase.from('assignment_rules').select('profile_id').eq('line', 'studio'),
  ]);
  if (rolesRes.error) {
    console.error('listStudioStaff roles', rolesRes.error.message);
    return [];
  }
  const roleIds = (rolesRes.data ?? [])
    .filter((r) => r.permissions.includes('canWorkStudio') || r.permissions.includes('canManageStudio'))
    .map((r) => r.id);
  const assigned = Array.from(new Set((rulesRes.data ?? []).map((r) => r.profile_id)));

  const filters = ['role.eq.super_admin'];
  if (roleIds.length > 0) filters.push(`admin_role_id.in.(${roleIds.join(',')})`);
  if (assigned.length > 0) filters.push(`id.in.(${assigned.join(',')})`);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .or(filters.join(','))
    .order('full_name', { ascending: true })
    .limit(100);
  if (error) {
    console.error('listStudioStaff', error.message);
    return [];
  }
  return (data ?? []).map((u) => ({ id: u.id, name: u.full_name }));
}

export type OrderStudioProject = {
  id: string;
  status: string;
  heldFrom: string | null;
  orderItemId: string;
  dueAt: string | null;
  orderClosed: boolean;
  childName: string | null;
};

/**
 * مشاريع القصة لطلب (لصفحة الطلب ورحلته). بتمشي بدالة القاعدة `order_studio_projects`:
 * مدير الطلبات يشوف الحالة من غير صلاحية استوديو، ومن غير النصوص ولا التكلفة.
 */
export async function getStudioProjectForOrder(orderId: string): Promise<OrderStudioProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('order_studio_projects', { p_order: orderId });
  if (error) {
    // قبل الـ migration: الدالة مش موجودة — نرجع للقراءة المباشرة (للمصرّح لهم بالاستوديو بس).
    if (error.code === 'PGRST202' || error.code === '42883') {
      const legacy = await supabase
        .from('story_projects')
        .select('id, status, order_item_id, held_from, due_at, order_closed_at')
        .eq('order_id', orderId)
        .limit(20);
      if (legacy.error) {
        console.error('getStudioProjectForOrder', legacy.error.message);
        return [];
      }
      return (legacy.data ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        heldFrom: r.held_from,
        orderItemId: r.order_item_id,
        dueAt: r.due_at,
        orderClosed: r.order_closed_at !== null,
        childName: null,
      }));
    }
    console.error('getStudioProjectForOrder', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    heldFrom: r.held_from,
    orderItemId: r.order_item_id,
    dueAt: r.due_at,
    orderClosed: r.order_closed,
    childName: r.child_name,
  }));
}

export type StudioOrderPanelData = {
  mode: 'off' | 'on';
  projects: OrderStudioProject[];
  /** بنود فيها تخصيص وماعندهاش مشروع — ينفع تتبدأ يدويًا (القاعدة بتتحقق من النوع والدفع). */
  startable: { orderItemId: string; productId: string }[];
};

/** بيانات لوحة «مشروع القصة» في صفحة الطلب. */
export async function getStudioOrderPanel(orderId: string): Promise<StudioOrderPanelData> {
  const supabase = await createClient();
  const [mode, projects, items] = await Promise.all([
    getStudioMode(),
    getStudioProjectForOrder(orderId),
    supabase
      .from('order_items')
      .select('id, product_id')
      .eq('order_id', orderId)
      .not('customization_data', 'is', null)
      .limit(50),
  ]);
  if (items.error) console.error('getStudioOrderPanel items', items.error.message);
  const taken = new Set(projects.map((p) => p.orderItemId));
  return {
    mode,
    projects,
    startable: (items.data ?? [])
      .filter((i) => !taken.has(i.id))
      .map((i) => ({ orderItemId: i.id, productId: i.product_id })),
  };
}

export type StudioReadiness = {
  tablesReady: boolean;
  mode: 'off' | 'on';
  /** الأدوار الجاهزة اللي موجودة فعلًا من الثلاثة. */
  rolesFound: string[];
  staffCount: number;
  projectCount: number;
  /** بنود مخصّصة في طلبات مدفوعة من غير مشروع (للاستيراد). */
  backfillPending: number;
};

export const STUDIO_ROLE_NAMES = ['محرر قصص', 'مشرف فني', 'مسؤول إنتاج القصص'] as const;

/** حالة تجهيز الاستوديو: إيه اللي اتطبّق وإيه لسه — لشاشة الإعدادات. */
export async function getStudioReadiness(): Promise<StudioReadiness> {
  const supabase = await createClient();
  const [mode, probe, roles, staff, pending] = await Promise.all([
    getStudioMode(),
    supabase.from('story_projects').select('id', { count: 'exact', head: true }),
    supabase.from('admin_roles').select('name').in('name', [...STUDIO_ROLE_NAMES]),
    listStudioStaff(),
    supabase.rpc('story_backfill_pending'),
  ]);
  const tablesReady = !probe.error;
  if (probe.error && !isMissingRelation(probe.error.code)) console.error('getStudioReadiness', probe.error.message);
  return {
    tablesReady,
    mode,
    rolesFound: (roles.data ?? []).map((r) => r.name),
    staffCount: staff.length,
    projectCount: tablesReady ? (probe.count ?? 0) : 0,
    backfillPending: tablesReady && typeof pending.data === 'number' ? pending.data : 0,
  };
}


export type StudioStages = {
  /** كل مرحلة في الكتالوج بترتيبها (فاضية لو الـ migration لسه ماتطبّقتش). */
  steps: TaskStep[];
  /** الأسماء اللي اتعدّلت — بتتمرّر لـ`statusLabel`. */
  labels: Record<string, string>;
  hints: Record<string, string>;
  /** مراحل تبويبها مخفي (لو مفيهاش مشاريع). */
  hiddenTabs: string[];
  /** سير العمل الكامل (مراحل + انتقالات + شروط). */
  flow: StudioFlow;
  /** محرك المراحل متطبّق في القاعدة؟ لو لأ بنعرض التدفق الافتراضي للقراءة بس. */
  engine: boolean;
};

const OWNER_KINDS: readonly string[] = ['editor', 'art_lead', 'manager'];

/** سير عمل الاستوديو من القاعدة (task_steps + task_edges). أي فشل/عدم تطبيق = التدفق الافتراضي. */
export async function getStudioFlow(): Promise<{ flow: StudioFlow; engine: boolean }> {
  const supabase = await createClient();
  const [stepsRes, edgesRes] = await Promise.all([
    supabase.from('task_steps').select('*').eq('line', 'studio').order('sort_order', { ascending: true }),
    supabase.from('task_edges').select('*').eq('line', 'studio'),
  ]);
  if (stepsRes.error || edgesRes.error) {
    const e = stepsRes.error ?? edgesRes.error;
    if (e && !isMissingRelation(e.code)) console.error('getStudioFlow', e.message);
    return { flow: DEFAULT_FLOW, engine: false };
  }
  const rows = stepsRes.data ?? [];
  // قبل الـ migration مفيش عمود kind — الجدول موجود بس من غير هيكل.
  if (rows.length === 0 || !('kind' in rows[0])) return { flow: DEFAULT_FLOW, engine: false };

  const steps: FlowStep[] = rows.map((r) => ({
    step: r.step,
    label: r.label,
    hint: r.hint,
    slaHours: r.sla_hours === null ? null : Number(r.sla_hours),
    ownerKind: (OWNER_KINDS.includes(r.owner_kind) ? r.owner_kind : 'manager') as StageOwnerKind,
    sortOrder: r.sort_order,
    showTab: r.show_tab,
    kind: isStageKind(r.kind) ? r.kind : 'stage',
    active: r.active,
    abilities: (r.abilities ?? []).filter(isAbility),
    gates: (r.gates ?? []).filter(isGateKey),
    advanceBy: r.advance_by === 'manager' ? 'manager' : 'owner',
    builtin: r.builtin,
  }));
  const edges: FlowEdge[] = (edgesRes.data ?? []).map((e) => ({
    from: e.from_step,
    to: e.to_step,
    who: e.who === 'manager' ? 'manager' : 'owner',
    skipGates: e.skip_gates,
    pagesRedo: e.pages_redo,
    resetQa: e.reset_qa,
  }));
  return { flow: buildFlow(steps, edges), engine: true };
}

/** مراحل الاستوديو من الكتالوج (الاسم/الشرح/ظهور التبويب + التدفق). أي فشل = الأسماء الأصلية. */
export async function getStudioStages(): Promise<StudioStages> {
  const [steps, { flow, engine }] = await Promise.all([getTaskSteps('studio').then((r) => r ?? []), getStudioFlow()]);
  return {
    steps,
    labels: Object.fromEntries(steps.map((s) => [s.step, s.label])),
    hints: Object.fromEntries(steps.filter((s) => s.hint).map((s) => [s.step, s.hint as string])),
    hiddenTabs: steps.filter((s) => !s.showTab).map((s) => s.step),
    flow,
    engine,
  };
}

export type StudioTaskInfo = {
  id: string;
  projectId: string;
  status: 'open' | 'done';
  dueAt: string | null;
  stepChangedAt: string;
  assigneeIds: string[];
  /** حالة موعد المرحلة الحالية (محسوبة وقت الطلب). */
  deadline: DeadlineState;
};

/** مهام المشاريع (موعد المرحلة الحالية ومسؤولها) — مفتاحها رقم المشروع. */
export async function getStudioTasks(): Promise<Map<string, StudioTaskInfo>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .select('*')
    .eq('line', 'studio')
    .eq('status', 'open')
    .limit(LIST_LIMIT);
  if (error) {
    console.error('getStudioTasks', error.message);
    return new Map();
  }
  const now = Date.now();
  return new Map(
    (data ?? []).map((t) => {
      const dueAt = t.due_at ?? null;
      const stepChangedAt = t.step_changed_at ?? t.created_at;
      return [
        t.source_id,
        {
          id: t.id,
          projectId: t.source_id,
          status: 'open' as const,
          dueAt,
          stepChangedAt,
          assigneeIds: t.assignee_ids ?? [],
          deadline: deadlineState({ status: 'open', dueAt, stepChangedAt }, now),
        },
      ] as const;
    }),
  );
}
