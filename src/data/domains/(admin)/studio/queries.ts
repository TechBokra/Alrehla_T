import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { QueryResult } from '@/data/query-result';
import type { Json } from '@/types/supabase';
import { isStudioStatus, type StudioStatus } from '@/lib/studio';

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
  status: StudioStatus;
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
      'id, order_id, order_item_id, product_id, status, age_band, page_target, face_mode, sensitive_topic, editor_id, art_lead_id, due_at, brief, created_at, updated_at',
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
      status: isStudioStatus(r.status) ? r.status : 'brief',
      ageBand: r.age_band,
      pageTarget: r.page_target,
      faceMode: r.face_mode === 'real' ? 'real' : 'cartoon',
      sensitiveTopic: r.sensitive_topic,
      editorId: r.editor_id,
      artLeadId: r.art_lead_id,
      dueAt: r.due_at,
      childName: briefChildName(r.brief),
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
        'id, order_id, order_item_id, product_id, status, held_from, brief, age_band, page_target, face_mode, photo_consent_at, photo_consent_note, sensitive_topic, editor_id, art_lead_id, due_at, character_notes, character_ref_url, character_approved_at, qa_checklist, qa_passed_at, delivered_at, delivery_note, created_at, updated_at',
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
        status: isStudioStatus(r.status) ? r.status : 'brief',
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
 * موظفو الاستوديو اللي ينفع يتعيّنوا: أي حساب دوره الإداري فيه صلاحية
 * استوديو، + مديرو النظام. لو الصلاحيات منعت القراءة بتتحول لقايمة فاضية
 * والشاشة بتقول كده بدل ما تخمّن.
 */
export async function listStudioStaff(): Promise<StudioStaff[]> {
  const supabase = await createClient();
  const { data: roles, error: rolesError } = await supabase
    .from('admin_roles')
    .select('id, permissions');
  if (rolesError) {
    console.error('listStudioStaff roles', rolesError.message);
    return [];
  }
  const roleIds = (roles ?? [])
    .filter((r) => r.permissions.includes('canWorkStudio') || r.permissions.includes('canManageStudio'))
    .map((r) => r.id);

  const filters = ['role.eq.super_admin'];
  if (roleIds.length > 0) filters.push(`admin_role_id.in.(${roleIds.join(',')})`);

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

/** مشروع القصة لبند طلب (لصفحة الطلب). */
export async function getStudioProjectForOrder(
  orderId: string,
): Promise<{ id: string; status: StudioStatus; orderItemId: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_projects')
    .select('id, status, order_item_id')
    .eq('order_id', orderId)
    .limit(20);
  if (error) {
    console.error('getStudioProjectForOrder', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    status: isStudioStatus(r.status) ? r.status : 'brief',
    orderItemId: r.order_item_id,
  }));
}

export type StudioOrderPanelData = {
  mode: 'off' | 'on';
  projects: { id: string; status: StudioStatus; orderItemId: string }[];
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
