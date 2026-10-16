import { describe, expect, it } from 'vitest';
import { qaItemsFor } from './studio';
import {
  DEFAULT_FLOW,
  GATE_KEYS,
  GATE_LABELS,
  buildFlow,
  flowBlockers,
  flowCanMove,
  flowMoves,
  flowNext,
  flowPipeline,
  flowSkipTargets,
  flowProblems,
  flowStep,
  isTerminalIn,
  ownerLabelOf,
  statusLabel,
  statusTone,
  type BlockerContext,
  type FlowStep,
  type StudioFlow,
} from './studio-flow';

const F = DEFAULT_FLOW;
const targets = (status: string, held: string | null = null) => flowMoves(F, status, held).map((m) => m.to);

describe('studio-flow — التدفق الافتراضي', () => {
  it('سليم بنيويًا', () => {
    expect(flowProblems(F)).toEqual([]);
  });

  it('كل شرط ليه تسمية', () => {
    for (const g of GATE_KEYS) expect(GATE_LABELS[g]).toBeTruthy();
  });

  it('الأمام: كل مرحلة تتبعها اللي بعدها لحد التسليم', () => {
    const pipe = flowPipeline(F).map((s) => s.step);
    expect(pipe[0]).toBe('brief');
    expect(pipe[pipe.length - 1]).toBe('delivered');
    for (let i = 0; i < pipe.length - 1; i += 1) expect(flowNext(F, pipe[i])).toBe(pipe[i + 1]);
    expect(flowNext(F, 'delivered')).toBeNull();
    expect(flowNext(F, 'on_hold')).toBeNull();
  });

  it('الانتقالات الأصلية بالظبط', () => {
    expect(targets('brief').sort()).toEqual(['cancelled', 'on_hold', 'text_draft']);
    expect(targets('text_review').sort()).toEqual(['cancelled', 'client_text_approval', 'on_hold', 'text_draft']);
    expect(targets('layout').sort()).toEqual(['art_review', 'cancelled', 'on_hold', 'qa', 'text_draft']);
    expect(targets('qa').sort()).toEqual(['cancelled', 'layout', 'on_hold', 'ready', 'text_draft']);
    expect(targets('ready').sort()).toEqual(['cancelled', 'delivered', 'on_hold', 'qa', 'text_draft']);
    expect(targets('delivered')).toEqual([]);
    expect(targets('cancelled')).toEqual([]);
  });

  it('الإيقاف يرجع للمحفوظة بس', () => {
    expect(targets('on_hold', 'layout')).toEqual(['layout']);
    expect(targets('on_hold', null)).toEqual([]);
    expect(targets('on_hold', 'delivered')).toEqual([]);
  });

  it('تعديل النطاق لمسؤول الإنتاج ويعيد الصفحات', () => {
    const m = flowMoves(F, 'scenes', null).find((x) => x.to === 'text_draft');
    expect(m).toMatchObject({ who: 'manager', pagesRedo: true, resetQa: true });
    const back = flowMoves(F, 'text_review', null).find((x) => x.to === 'text_draft');
    expect(back).toMatchObject({ who: 'owner', pagesRedo: false });
  });
});

describe('studio-flow — مين يقدر يحرّك', () => {
  const worker = { canManage: false, isWorker: true };
  const stranger = { canManage: false, isWorker: false };
  const manager = { canManage: true, isWorker: false };
  const move = (from: string, to: string) => flowMoves(F, from, null).find((m) => m.to === to)!;

  it('صاحب المرحلة يتقدّم، وغيره لأ', () => {
    expect(flowCanMove(worker, move('text_draft', 'text_review'), 'text_draft', F)).toBe(true);
    expect(flowCanMove(stranger, move('text_draft', 'text_review'), 'text_draft', F)).toBe(false);
  });

  it('الفحص النهائي والتسليم والإيقاف لمسؤول الإنتاج', () => {
    expect(flowCanMove(worker, move('qa', 'ready'), 'qa', F)).toBe(false);
    expect(flowCanMove(worker, move('ready', 'delivered'), 'ready', F)).toBe(false);
    expect(flowCanMove(worker, move('scenes', 'on_hold'), 'scenes', F)).toBe(false);
    expect(flowCanMove(worker, move('scenes', 'text_draft'), 'scenes', F)).toBe(false);
    expect(flowCanMove(manager, move('scenes', 'on_hold'), 'scenes', F)).toBe(true);
  });

  it('المنتهي مايتحرّكش', () => {
    expect(flowCanMove(manager, { to: 'qa', who: 'owner', skipGates: false, pagesRedo: false, resetQa: false, type: 'edge' }, 'delivered', F)).toBe(false);
    expect(isTerminalIn(F, 'cancelled')).toBe(true);
  });
});

describe('studio-flow — مرحلة مضافة وتعديلات', () => {
  const extra: FlowStep = {
    step: 'x_legal',
    label: 'مراجعة قانونية',
    hint: null,
    slaHours: 24,
    ownerKind: 'editor',
    sortOrder: 35,
    showTab: true,
    kind: 'stage',
    active: true,
    abilities: ['text'],
    gates: ['text_editor_approved'],
    advanceBy: 'owner',
    optional: false,
    builtin: false,
  };
  const withExtra: StudioFlow = buildFlow([...F.steps, extra], F.edges);

  it('تدخل في التسلسل مكانها', () => {
    expect(flowNext(withExtra, 'text_review')).toBe('x_legal');
    expect(flowNext(withExtra, 'x_legal')).toBe('client_text_approval');
    expect(flowProblems(withExtra)).toEqual([]);
  });

  it('المعطّلة بتتخطّى ومش هدف', () => {
    const off = buildFlow(withExtra.steps.map((s) => (s.step === 'x_legal' ? { ...s, active: false } : s)), F.edges);
    expect(flowNext(off, 'text_review')).toBe('client_text_approval');
    expect(flowMoves(off, 'text_review', null).map((m) => m.to)).not.toContain('x_legal');
    expect(flowPipeline(off).map((s) => s.step)).not.toContain('x_legal');
  });

  it('شروطها بتظهر كنواقص', () => {
    const c: BlockerContext = {
      faceMode: 'cartoon',
      photoConsentAt: null,
      characterApprovedAt: null,
      sensitiveTopic: false,
      qaChecklist: {},
      versions: [{ status: 'draft' }],
      pages: [],
    };
    expect(flowBlockers(withExtra, 'x_legal', c)).toHaveLength(1);
    expect(flowBlockers(withExtra, 'x_legal', { ...c, versions: [{ status: 'editor_approved' }] })).toEqual([]);
    expect(flowBlockers(withExtra, 'x_legal', c, true)).toEqual([]);
  });

  it('اكتشاف تدفق مكسور', () => {
    const noDone = buildFlow(F.steps.filter((s) => s.kind !== 'done'), F.edges);
    expect(flowProblems(noDone).length).toBeGreaterThan(0);
    const badEdge = buildFlow(F.steps, [...F.edges, { from: 'qa', to: 'ghost', who: 'owner', skipGates: false, pagesRedo: false, resetQa: false }]);
    expect(flowProblems(badEdge).some((p) => p.includes('ghost'))).toBe(true);
  });
});

describe('studio-flow — تسميات وشروط', () => {
  it('الاسم من الكتالوج الحي ثم الافتراضي', () => {
    expect(statusLabel('qa')).toBe('فحص الجودة');
    expect(statusLabel('qa', { qa: 'مراجعة الجودة' })).toBe('مراجعة الجودة');
    expect(statusLabel('zzz')).toBe('zzz');
  });

  it('لون مرحلة مضافة من نوعها', () => {
    expect(statusTone('qa')).toBe('warning');
    expect(statusTone('cancelled')).toBe('danger');
    expect(statusTone('x_unknown')).toBe('info');
  });

  it('صاحب المرحلة للعرض', () => {
    expect(ownerLabelOf(F, 'text_review')).toBe('المحرّر');
    expect(ownerLabelOf(F, 'layout')).toBe('المشرف الفني');
    expect(ownerLabelOf(F, 'qa')).toBe('مسؤول الإنتاج');
    expect(ownerLabelOf(F, 'delivered')).toBe('—');
    expect(flowStep(F, 'ghost')).toBeUndefined();
  });

  const base: BlockerContext = {
    faceMode: 'cartoon',
    photoConsentAt: null,
    characterApprovedAt: null,
    sensitiveTopic: false,
    qaChecklist: {},
    versions: [],
    pages: [],
  };

  it('مراجعة النص تحتاج نسخة غير مستبدلة', () => {
    expect(flowBlockers(F, 'text_review', base)).toHaveLength(1);
    expect(flowBlockers(F, 'text_review', { ...base, versions: [{ status: 'superseded' }] })).toHaveLength(1);
    expect(flowBlockers(F, 'text_review', { ...base, versions: [{ status: 'draft' }] })).toEqual([]);
  });

  it('الشخصية: موافقة العميل + الصورة للوجه الحقيقي', () => {
    expect(flowBlockers(F, 'character', base)).toHaveLength(1);
    const ok = { ...base, versions: [{ status: 'client_approved' }] };
    expect(flowBlockers(F, 'character', ok)).toEqual([]);
    expect(flowBlockers(F, 'character', { ...ok, faceMode: 'real' as const })).toHaveLength(1);
  });

  it('الصفحات والتركيب والجاهز', () => {
    expect(flowBlockers(F, 'scenes', base)).toHaveLength(1);
    expect(flowBlockers(F, 'scenes', { ...base, characterApprovedAt: 'x' })).toEqual([]);
    expect(flowBlockers(F, 'art_review', base)).toHaveLength(1);
    expect(flowBlockers(F, 'art_review', { ...base, pages: [{ status: 'drafted' }] })).toEqual([]);
    expect(flowBlockers(F, 'layout', { ...base, pages: [{ status: 'drafted' }] })).toHaveLength(1);
    expect(flowBlockers(F, 'layout', { ...base, pages: [{ status: 'approved' }] })).toEqual([]);
    const full = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, true]));
    expect(flowBlockers(F, 'ready', base)).toHaveLength(1);
    expect(flowBlockers(F, 'ready', { ...base, qaChecklist: full })).toEqual([]);
    expect(flowBlockers(F, 'ready', { ...base, qaChecklist: full, sensitiveTopic: true })).toHaveLength(1);
  });
});

describe('studio-flow — مراحل اختيارية وإلزامية', () => {
  const withOptional = (...keys: string[]): StudioFlow =>
    buildFlow(
      F.steps.map((st) => (keys.includes(st.step) ? { ...st, optional: true } : st)),
      F.edges,
    );

  it('الإلزامية هي الأصل: مفيش تخطّي في التدفق الافتراضي', () => {
    expect(F.steps.every((st) => !st.optional)).toBe(true);
    expect(flowSkipTargets(F, 'text_review')).toEqual([]);
    expect(flowMoves(F, 'text_review', null).some((m) => m.type === 'skip')).toBe(false);
  });

  it('الاختيارية بتديك زر تخطّي للي بعدها', () => {
    const f = withOptional('client_text_approval');
    expect(flowSkipTargets(f, 'text_review')).toEqual(['character']);
    const skip = flowMoves(f, 'text_review', null).find((m) => m.type === 'skip');
    expect(skip).toMatchObject({ to: 'character', who: 'owner', skipGates: false });
    // التالي العادي لسه موجود.
    expect(flowMoves(f, 'text_review', null).some((m) => m.type === 'forward' && m.to === 'client_text_approval')).toBe(true);
  });

  it('اتنين اختياريين ورا بعض = تخطّي لكل واحد منهم وللي بعدهم', () => {
    const f = withOptional('client_text_approval', 'character');
    expect(flowSkipTargets(f, 'text_review')).toEqual(['character', 'scenes']);
  });

  it('مرحلة إلزامية بتقطع التخطّي', () => {
    const f = withOptional('client_text_approval');
    expect(flowSkipTargets(f, 'text_review')).not.toContain('scenes');
  });

  it('الاختيارية الأخيرة قبل التسليم تتخطّى للتسليم', () => {
    const f = withOptional('ready');
    expect(flowSkipTargets(f, 'qa')).toEqual(['delivered']);
  });

  it('التخطّي بنفس صاحب نقل المرحلة الحالية', () => {
    const f = withOptional('ready');
    expect(flowMoves(f, 'qa', null).find((m) => m.type === 'skip')?.who).toBe('manager');
  });

  it('المرحلة المعطّلة مش بتعمل تخطّي ومش هدف', () => {
    const f = buildFlow(
      F.steps.map((st) => (st.step === 'client_text_approval' ? { ...st, active: false } : st)),
      F.edges,
    );
    expect(flowSkipTargets(f, 'text_review')).toEqual([]);
  });

  it('الانتقال الاستثنائي أقوى من التخطّي لنفس الهدف', () => {
    const f = buildFlow(
      withOptional('client_text_approval').steps,
      [...F.edges, { from: 'text_review', to: 'character', who: 'manager', skipGates: true, pagesRedo: false, resetQa: false }],
    );
    const hits = flowMoves(f, 'text_review', null).filter((m) => m.to === 'character');
    expect(hits).toHaveLength(1);
    expect(hits[0].type).toBe('edge');
  });
});
