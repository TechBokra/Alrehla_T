/**
 * استوديو القصص — سير العمل كبيانات (مراحل · انتقالات · شروط · أصحاب).
 *
 * المصدر الحقيقي جدولا `task_steps` و`task_edges` في القاعدة، والحارس الفعلي
 * محفّز `story_project_guard` (ملف `20261016040000_workflow_engine_unified_distribution.sql`).
 * اللي هنا بيخدم الشاشة بس: يعرض الأزرار الصح ويقول السبب قبل ما الطلب يوصل
 * للقاعدة، والقاعدة بترفض أي انتقال غلط على أي حال.
 *
 * `DEFAULT_FLOW` = مرآة بيانات الـ seed (وبديل لو الـ migration لسه ماتطبّقتش).
 * `studio-flow.test.ts` بيمسك التناقض الداخلي.
 *
 * ملف خفيف بلا تبعيات: الاستوديو كله تحت لوحة الإدارة.
 */

import type { StudioTone } from '@/lib/studio';
import { qaMissing } from '@/lib/studio';

export type StageKind = 'start' | 'stage' | 'hold' | 'done' | 'cancel';
export type StageOwnerKind = 'editor' | 'art_lead' | 'manager';
export type StageAbility = 'text' | 'pages';
export type AdvanceBy = 'owner' | 'manager';

export const STAGE_KINDS: readonly StageKind[] = ['start', 'stage', 'hold', 'done', 'cancel'];

export const ABILITY_LABELS: Record<StageAbility, string> = {
  text: 'كتابة النص ونسخه',
  pages: 'تجهيز الصفحات والرسوم',
};

/** شروط دخول المرحلة — مفردات ثابتة في القاعدة، والتركيب (أنهي مرحلة تشترط إيه) بالبيانات. */
export const GATE_KEYS = [
  'has_text',
  'text_editor_approved',
  'text_client_approved',
  'photo_consent',
  'character_approved',
  'pages_ready',
  'pages_approved',
  'qa_complete',
] as const;
export type GateKey = (typeof GATE_KEYS)[number];

export const GATE_LABELS: Record<GateKey, string> = {
  has_text: 'فيه نسخة نص مكتوبة',
  text_editor_approved: 'نسخة نص معتمدة من المحرّر',
  text_client_approved: 'موافقة العميل على النص',
  photo_consent: 'موافقة ولي الأمر على الصورة (للوجه الحقيقي)',
  character_approved: 'مرجع الشخصية معتمد',
  pages_ready: 'كل الصفحات مجهّزة',
  pages_approved: 'كل الصفحات معتمدة',
  qa_complete: 'قايمة فحص الجودة مكتملة',
};

export const OWNER_KIND_LABELS: Record<StageOwnerKind, string> = {
  editor: 'المحرّر',
  art_lead: 'المشرف الفني',
  manager: 'مسؤول الإنتاج',
};

export type FlowStep = {
  step: string;
  label: string;
  hint: string | null;
  slaHours: number | null;
  ownerKind: StageOwnerKind;
  sortOrder: number;
  showTab: boolean;
  kind: StageKind;
  active: boolean;
  abilities: StageAbility[];
  gates: GateKey[];
  advanceBy: AdvanceBy;
  /** من الأصل (مش مضافة من الشاشة). */
  builtin: boolean;
};

export type FlowEdge = {
  from: string;
  to: string;
  who: AdvanceBy;
  skipGates: boolean;
  pagesRedo: boolean;
  resetQa: boolean;
};

export type StudioFlow = { steps: FlowStep[]; edges: FlowEdge[] };

export function isStageKind(v: unknown): v is StageKind {
  return typeof v === 'string' && (STAGE_KINDS as readonly string[]).includes(v);
}
export function isGateKey(v: unknown): v is GateKey {
  return typeof v === 'string' && (GATE_KEYS as readonly string[]).includes(v);
}
export function isAbility(v: unknown): v is StageAbility {
  return v === 'text' || v === 'pages';
}

// ── البيانات الافتراضية (مرآة الـ seed) ─────────────────────────────────────

const S = (
  step: string,
  label: string,
  sortOrder: number,
  ownerKind: StageOwnerKind,
  rest: Partial<FlowStep> = {},
): FlowStep => ({
  step,
  label,
  hint: null,
  slaHours: null,
  ownerKind,
  sortOrder,
  showTab: true,
  kind: 'stage',
  active: true,
  abilities: [],
  gates: [],
  advanceBy: 'owner',
  builtin: true,
  ...rest,
});

const DEFAULT_STEPS: FlowStep[] = [
  S('brief', 'الطلب', 10, 'editor', { kind: 'start' }),
  S('text_draft', 'كتابة النص', 20, 'editor', { abilities: ['text'] }),
  S('text_review', 'مراجعة النص', 30, 'editor', { abilities: ['text'], gates: ['has_text'] }),
  S('client_text_approval', 'موافقة العميل على النص', 40, 'editor', {
    abilities: ['text'],
    gates: ['text_editor_approved'],
  }),
  S('character', 'الشخصية', 50, 'art_lead', {
    abilities: ['pages'],
    gates: ['text_client_approved', 'photo_consent'],
  }),
  S('scenes', 'المشاهد', 60, 'art_lead', { abilities: ['pages'], gates: ['character_approved'] }),
  S('art_review', 'مراجعة الرسوم', 70, 'art_lead', { abilities: ['pages'], gates: ['pages_ready'] }),
  S('layout', 'التركيب', 80, 'art_lead', { abilities: ['pages'], gates: ['pages_approved'] }),
  S('qa', 'فحص الجودة', 90, 'manager', { advanceBy: 'manager' }),
  S('ready', 'جاهز للتسليم', 100, 'manager', { advanceBy: 'manager', gates: ['qa_complete'] }),
  S('delivered', 'تم التسليم', 1000, 'manager', { kind: 'done', showTab: false }),
  S('on_hold', 'موقوف مؤقتًا', 1050, 'manager', { kind: 'hold' }),
  S('cancelled', 'ملغي', 1100, 'manager', { kind: 'cancel', showTab: false }),
];

const E = (
  from: string,
  to: string,
  who: AdvanceBy,
  rest: Partial<FlowEdge> = {},
): FlowEdge => ({ from, to, who, skipGates: false, pagesRedo: false, resetQa: false, ...rest });

const DEFAULT_EDGES: FlowEdge[] = [
  E('text_review', 'text_draft', 'owner'),
  E('client_text_approval', 'text_draft', 'owner'),
  E('art_review', 'scenes', 'owner'),
  E('layout', 'art_review', 'owner'),
  E('qa', 'layout', 'manager', { skipGates: true }),
  E('ready', 'qa', 'manager', { resetQa: true }),
  ...['character', 'scenes', 'art_review', 'layout', 'qa', 'ready'].map((f) =>
    E(f, 'text_draft', 'manager', { pagesRedo: true, resetQa: true }),
  ),
];

export const DEFAULT_FLOW: StudioFlow = { steps: DEFAULT_STEPS, edges: DEFAULT_EDGES };

/** رتّب المراحل (بالترتيب ثم المفتاح) — ثابت ومتوقّع. */
export function buildFlow(steps: FlowStep[], edges: FlowEdge[]): StudioFlow {
  return {
    steps: [...steps].sort((a, b) => a.sortOrder - b.sortOrder || a.step.localeCompare(b.step)),
    edges,
  };
}

// ── استعلامات على التدفق ────────────────────────────────────────────────────

export function flowStep(flow: StudioFlow, key: string): FlowStep | undefined {
  return flow.steps.find((s) => s.step === key);
}

export function isKnownStatus(flow: StudioFlow, key: unknown): key is string {
  return typeof key === 'string' && flow.steps.some((s) => s.step === key);
}

export function isTerminalIn(flow: StudioFlow, key: string): boolean {
  const k = flowStep(flow, key)?.kind;
  return k === 'done' || k === 'cancel';
}

export function isHold(flow: StudioFlow, key: string): boolean {
  return flowStep(flow, key)?.kind === 'hold';
}

/** مراحل الشغل الفعلية بترتيبها (بداية + مراحل فعّالة + التسليم) — لشريط التقدّم. */
export function flowPipeline(flow: StudioFlow): FlowStep[] {
  return flow.steps.filter((s) => s.active && (s.kind === 'start' || s.kind === 'stage' || s.kind === 'done'));
}

/** المراحل اللي ينفع المشروع يقف فيها وهو شغّال (من غير التسليم). */
export function flowWorkStages(flow: StudioFlow): FlowStep[] {
  return flow.steps.filter((s) => s.kind === 'start' || s.kind === 'stage');
}

/** «التالي» للأمام: أقرب مرحلة فعّالة بعدها (مرآة `task_next_step`). */
export function flowNext(flow: StudioFlow, key: string): string | null {
  const cur = flowStep(flow, key);
  if (!cur || (cur.kind !== 'start' && cur.kind !== 'stage')) return null;
  const hit = flow.steps.find(
    (s) => s.active && (s.kind === 'stage' || s.kind === 'done') && s.sortOrder > cur.sortOrder,
  );
  return hit?.step ?? null;
}

export type FlowMove = {
  to: string;
  /** مين ينفّذ: صاحب المرحلة أو مسؤول الإنتاج. */
  who: AdvanceBy;
  skipGates: boolean;
  pagesRedo: boolean;
  resetQa: boolean;
  /** «للأمام» العادي، رجوع/قفز استثنائي، أو إيقاف/إلغاء/استئناف. */
  type: 'forward' | 'edge' | 'hold' | 'cancel' | 'resume';
};

/** الانتقالات المتاحة من حالة (مرآة `story_transition_rule`). */
export function flowMoves(flow: StudioFlow, status: string, heldFrom: string | null): FlowMove[] {
  const cur = flowStep(flow, status);
  if (!cur || cur.kind === 'done' || cur.kind === 'cancel') return [];
  if (cur.kind === 'hold') {
    const back = heldFrom ? flowStep(flow, heldFrom) : undefined;
    if (!back || !back.active || (back.kind !== 'start' && back.kind !== 'stage')) return [];
    return [{ to: back.step, who: 'manager', skipGates: false, pagesRedo: false, resetQa: false, type: 'resume' }];
  }
  const out: FlowMove[] = [];
  const next = flowNext(flow, status);
  if (next) {
    out.push({ to: next, who: cur.advanceBy, skipGates: false, pagesRedo: false, resetQa: false, type: 'forward' });
  }
  for (const e of flow.edges) {
    if (e.from !== status || e.to === next) continue;
    const target = flowStep(flow, e.to);
    if (!target || !target.active) continue;
    out.push({ to: e.to, who: e.who, skipGates: e.skipGates, pagesRedo: e.pagesRedo, resetQa: e.resetQa, type: 'edge' });
  }
  for (const s of flow.steps) {
    if (!s.active) continue;
    if (s.kind === 'hold') out.push({ to: s.step, who: 'manager', skipGates: false, pagesRedo: false, resetQa: false, type: 'hold' });
    if (s.kind === 'cancel') out.push({ to: s.step, who: 'manager', skipGates: false, pagesRedo: false, resetQa: false, type: 'cancel' });
  }
  return out;
}

export type FlowActor = {
  /** مسؤول الإنتاج (أو مدير النظام). */
  canManage: boolean;
  /** صاحب المرحلة الحالية للمشروع ده (مسند له المهمة أو المحرر/المشرف المعيّن). */
  isWorker: boolean;
};

export function flowCanMove(actor: FlowActor, move: FlowMove, status: string, flow: StudioFlow): boolean {
  if (isTerminalIn(flow, status)) return false;
  if (actor.canManage) return true;
  if (move.who === 'manager') return false;
  return actor.isWorker;
}

/** مين صاحب المرحلة (للعرض). */
export function ownerLabelOf(flow: StudioFlow, key: string): string {
  const s = flowStep(flow, key);
  if (!s || s.kind === 'done' || s.kind === 'cancel') return '—';
  return OWNER_KIND_LABELS[s.ownerKind];
}

// ── التسميات والألوان ───────────────────────────────────────────────────────

const BUILTIN_TONES: Record<string, StudioTone> = {
  brief: 'pending',
  text_draft: 'info',
  text_review: 'warning',
  client_text_approval: 'warning',
  character: 'info',
  scenes: 'info',
  art_review: 'warning',
  layout: 'info',
  qa: 'warning',
  ready: 'success',
};

const KIND_TONES: Record<StageKind, StudioTone> = {
  start: 'pending',
  stage: 'info',
  hold: 'neutral',
  done: 'success',
  cancel: 'danger',
};

/** اسم المرحلة: من الكتالوج الحي، ثم الافتراضي، وإلا المفتاح. */
export function statusLabel(v: string, overrides?: Partial<Record<string, string>>): string {
  const custom = overrides?.[v];
  if (custom) return custom;
  return flowStep(DEFAULT_FLOW, v)?.label ?? v;
}

export function statusTone(v: string, flow: StudioFlow = DEFAULT_FLOW): StudioTone {
  if (BUILTIN_TONES[v]) return BUILTIN_TONES[v];
  const k = flowStep(flow, v)?.kind ?? flowStep(DEFAULT_FLOW, v)?.kind;
  return k ? KIND_TONES[k] : 'info';
}

// ── الشروط المسبقة (مرآة `story_gate_check` — للعرض فقط) ────────────────────

export type BlockerContext = {
  faceMode: 'cartoon' | 'real';
  photoConsentAt: string | null;
  characterApprovedAt: string | null;
  sensitiveTopic: boolean;
  qaChecklist: Record<string, boolean>;
  versions: { status: string }[];
  pages: { status: string }[];
};

const GATE_BLOCKERS: Record<GateKey, (c: BlockerContext) => string | null> = {
  has_text: (c) => (c.versions.some((v) => v.status !== 'superseded') ? null : 'اكتب نسخة من النص.'),
  text_editor_approved: (c) =>
    c.versions.some((v) => v.status === 'editor_approved') ? null : 'اعتمد نسخة النص كمحرّر.',
  text_client_approved: (c) =>
    c.versions.some((v) => v.status === 'client_approved') ? null : 'سجّل موافقة العميل على النص.',
  photo_consent: (c) =>
    c.faceMode === 'real' && !c.photoConsentAt ? 'سجّل موافقة ولي الأمر على استخدام الصورة (الوجه الحقيقي).' : null,
  character_approved: (c) => (c.characterApprovedAt ? null : 'اعتمد مرجع الشخصية.'),
  pages_ready: (c) => {
    if (c.pages.length === 0) return 'أضف صفحات الكتاب.';
    return c.pages.some((p) => p.status === 'pending' || p.status === 'needs_redo')
      ? 'كل الصفحات لازم تتجهّز (نص ومشهد وصورة).'
      : null;
  },
  pages_approved: (c) =>
    c.pages.length === 0 || c.pages.some((p) => p.status !== 'approved') ? 'كل الصفحات لازم تتعتمد.' : null,
  qa_complete: (c) => {
    const missing = qaMissing(c.qaChecklist, c.sensitiveTopic);
    return missing.length > 0 ? `قايمة فحص الجودة ناقصة (${missing.length}).` : null;
  },
};

/**
 * إيه اللي ناقص عشان الانتقال لـ`to` يتقبل؟ فاضية = جاهز.
 * القاعدة هي اللي بترفض فعلًا؛ ده بس عشان الشاشة تقول السبب قبل الضغط.
 */
export function flowBlockers(flow: StudioFlow, to: string, c: BlockerContext, skipGates = false): string[] {
  if (skipGates) return [];
  const step = flowStep(flow, to);
  if (!step) return [];
  return step.gates.map((g) => GATE_BLOCKERS[g](c)).filter((m): m is string => m !== null);
}

// ── تحقّق من التدفق نفسه (قبل الحفظ من الشاشة) ──────────────────────────────

/** مشاكل بنيوية في التدفق — فاضية = سليم. للعرض في شاشة التحرير. */
export function flowProblems(flow: StudioFlow): string[] {
  const out: string[] = [];
  const starts = flow.steps.filter((s) => s.kind === 'start');
  if (starts.length !== 1) out.push('لازم مرحلة بداية واحدة بالظبط.');
  for (const k of ['hold', 'done', 'cancel'] as const) {
    if (!flow.steps.some((s) => s.kind === k)) out.push(`ناقص مرحلة نظامية (${k}).`);
  }
  const keys = new Set(flow.steps.map((s) => s.step));
  for (const e of flow.edges) {
    if (!keys.has(e.from) || !keys.has(e.to)) out.push(`انتقال بمرحلة مش موجودة: ${e.from} ← ${e.to}.`);
  }
  // كل مرحلة فعّالة لازم توصل للتسليم بالتقدّم للأمام.
  for (const s of flow.steps.filter((x) => x.active && (x.kind === 'start' || x.kind === 'stage'))) {
    let cur: string | null = s.step;
    let guard = 0;
    while (cur && guard++ < 100) {
      const kind = flowStep(flow, cur)?.kind;
      if (kind === 'done') break;
      cur = flowNext(flow, cur);
    }
    if (!cur || flowStep(flow, cur)?.kind !== 'done') out.push(`المرحلة «${s.label}» مابتوصلش للتسليم.`);
  }
  return out;
}
