import { describe, expect, it } from 'vitest';
import {
  STUDIO_PIPELINE,
  STUDIO_STATUSES,
  STATUS_LABELS,
  STATUS_TONES,
  canMove,
  isHttpsUrl,
  isScopeChange,
  nextStatuses,
  qaItemsFor,
  qaMissing,
  stageOwner,
  studioBlockers,
  type BlockerContext,
  studioErrorMessage,
  transitionNeedsManager,
  type StudioActor,
  type StudioStatus,
} from './studio';

const editor: StudioActor = { id: 'e1', canManage: false, canWork: true };
const art: StudioActor = { id: 'a1', canManage: false, canWork: true };
const manager: StudioActor = { id: 'm1', canManage: true, canWork: true };

const proj = (status: StudioStatus) => ({ status, editorId: 'e1', artLeadId: 'a1' });

describe('studio — الثوابت', () => {
  it('كل حالة ليها اسم ولون', () => {
    for (const s of STUDIO_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_TONES[s]).toBeTruthy();
    }
  });

  it('خط الإنتاج كله حالات معروفة وبلا تكرار', () => {
    expect(new Set(STUDIO_PIPELINE).size).toBe(STUDIO_PIPELINE.length);
    for (const s of STUDIO_PIPELINE) expect(STUDIO_STATUSES).toContain(s);
  });
});

describe('studio — الانتقالات', () => {
  it('كل انتقال هدفه حالة معروفة', () => {
    for (const s of STUDIO_STATUSES) {
      for (const t of nextStatuses(s, 'qa')) expect(STUDIO_STATUSES).toContain(t);
    }
  });

  it('المنتهي مفيهوش انتقالات', () => {
    expect(nextStatuses('delivered', null)).toEqual([]);
    expect(nextStatuses('cancelled', null)).toEqual([]);
  });

  it('الموقوف يرجع لمكانه بس', () => {
    expect(nextStatuses('on_hold', 'layout')).toEqual(['layout']);
    expect(nextStatuses('on_hold', null)).toEqual([]);
  });

  it('الأمام خطوة واحدة في المسار الأساسي', () => {
    for (let i = 0; i < STUDIO_PIPELINE.length - 1; i += 1) {
      expect(nextStatuses(STUDIO_PIPELINE[i], null)).toContain(STUDIO_PIPELINE[i + 1]);
    }
  });

  it('تعديل النص بعد الرسم = تعديل نطاق', () => {
    expect(isScopeChange('scenes', 'text_draft')).toBe(true);
    expect(isScopeChange('text_review', 'text_draft')).toBe(false);
    expect(isScopeChange('ready', 'text_draft')).toBe(true);
  });
});

describe('studio — مين يحرّك', () => {
  it('المحرّر يحرّك مراحل النص لمشروعه بس', () => {
    expect(canMove(editor, proj('text_draft'), 'text_review')).toBe(true);
    expect(canMove({ ...editor, id: 'other' }, proj('text_draft'), 'text_review')).toBe(false);
  });

  it('المحرّر ما يبدأش الرسم ولا يسلّم', () => {
    expect(canMove(editor, proj('character'), 'scenes')).toBe(false);
    expect(canMove(editor, proj('ready'), 'delivered')).toBe(false);
  });

  it('المشرف الفني يحرّك الرسم لمشروعه بس', () => {
    expect(canMove(art, proj('scenes'), 'art_review')).toBe(true);
    expect(canMove({ ...art, id: 'x' }, proj('scenes'), 'art_review')).toBe(false);
  });

  it('الإيقاف والإلغاء والتسليم وتعديل النطاق لمسؤول الإنتاج', () => {
    expect(transitionNeedsManager('scenes', 'on_hold')).toBe(true);
    expect(transitionNeedsManager('brief', 'cancelled')).toBe(true);
    expect(transitionNeedsManager('qa', 'ready')).toBe(true);
    expect(transitionNeedsManager('scenes', 'text_draft')).toBe(true);
    expect(canMove(art, proj('scenes'), 'on_hold')).toBe(false);
    expect(canMove(manager, proj('scenes'), 'on_hold')).toBe(true);
  });

  it('مفيش حد يحرّك مشروع منتهي', () => {
    expect(canMove(manager, proj('delivered'), 'qa')).toBe(false);
    expect(canMove(manager, proj('cancelled'), 'brief')).toBe(false);
  });

  it('صاحب المرحلة', () => {
    expect(stageOwner('text_review')).toBe('editor');
    expect(stageOwner('layout')).toBe('art');
    expect(stageOwner('qa')).toBe('manager');
    expect(stageOwner('delivered')).toBe('none');
  });
});

describe('studio — فحص الجودة', () => {
  it('الموضوع الحسّاس بيضيف بند', () => {
    expect(qaItemsFor(false)).toHaveLength(6);
    expect(qaItemsFor(true)).toHaveLength(7);
  });

  it('بيرجّع الناقص', () => {
    expect(qaMissing({}, false)).toHaveLength(6);
    const full = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, true]));
    expect(qaMissing(full, false)).toEqual([]);
    expect(qaMissing(full, true)).toEqual(['sensitive_review']);
  });

  it('قيمة غير true مش بتتحسب', () => {
    const c = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, 'true']));
    expect(qaMissing(c, false)).toHaveLength(6);
    expect(qaMissing(null, false)).toHaveLength(6);
  });
});

describe('studio — تحقّقات', () => {
  it('رابط https فقط', () => {
    expect(isHttpsUrl('https://res.cloudinary.com/x/y.jpg')).toBe(true);
    expect(isHttpsUrl('http://example.com/a.jpg')).toBe(false);
    expect(isHttpsUrl('https://a b')).toBe(false);
    expect(isHttpsUrl(`https://a.com/${'x'.repeat(500)}`)).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
  });

  it('رسائل الأخطاء', () => {
    expect(studioErrorMessage({ code: '23514', message: 'اعتمد مرجع الشخصية الأول' })).toBe('اعتمد مرجع الشخصية الأول');
    expect(studioErrorMessage({ code: '42501', message: 'permission denied' })).toMatch(/صلاحية/);
    expect(studioErrorMessage({ code: '55000', message: 'x' })).toMatch(/مقفول/);
    expect(studioErrorMessage(null)).toBeTruthy();
  });
});

describe('studio — الشروط المسبقة', () => {
  const base: BlockerContext = {
    from: 'brief',
    faceMode: 'cartoon',
    photoConsentAt: null,
    characterApprovedAt: null,
    sensitiveTopic: false,
    qaChecklist: {},
    versions: [],
    pages: [],
  };

  it('مراجعة النص تحتاج نسخة غير مستبدلة', () => {
    expect(studioBlockers('text_review', base)).toHaveLength(1);
    expect(studioBlockers('text_review', { ...base, versions: [{ status: 'superseded' }] })).toHaveLength(1);
    expect(studioBlockers('text_review', { ...base, versions: [{ status: 'draft' }] })).toEqual([]);
  });

  it('موافقة العميل تحتاج نسخة معتمدة من المحرّر', () => {
    expect(studioBlockers('client_text_approval', { ...base, versions: [{ status: 'draft' }] })).toHaveLength(1);
    expect(studioBlockers('client_text_approval', { ...base, versions: [{ status: 'editor_approved' }] })).toEqual([]);
  });

  it('الشخصية: موافقة العميل ثم موافقة الصورة للوجه الحقيقي', () => {
    const c = { ...base, from: 'client_text_approval' as const };
    expect(studioBlockers('character', c)).toHaveLength(1);
    const ok = { ...c, versions: [{ status: 'client_approved' }] };
    expect(studioBlockers('character', ok)).toEqual([]);
    expect(studioBlockers('character', { ...ok, faceMode: 'real' })).toHaveLength(1);
    expect(studioBlockers('character', { ...ok, faceMode: 'real', photoConsentAt: '2026-10-16' })).toEqual([]);
  });

  it('المشاهد تحتاج مرجع شخصية معتمد', () => {
    expect(studioBlockers('scenes', base)).toHaveLength(1);
    expect(studioBlockers('scenes', { ...base, characterApprovedAt: '2026-10-16' })).toEqual([]);
  });

  it('مراجعة الرسوم والتركيب تحتاج صفحات جاهزة ثم معتمدة', () => {
    expect(studioBlockers('art_review', base)).toHaveLength(1);
    expect(studioBlockers('art_review', { ...base, pages: [{ status: 'pending' }] })).toHaveLength(1);
    expect(studioBlockers('art_review', { ...base, pages: [{ status: 'drafted' }] })).toEqual([]);
    const l = { ...base, from: 'art_review' as const };
    expect(studioBlockers('layout', { ...l, pages: [{ status: 'drafted' }] })).toHaveLength(1);
    expect(studioBlockers('layout', { ...l, pages: [{ status: 'approved' }] })).toEqual([]);
    // الرجوع من الفحص للتركيب مايطلبش اعتماد من جديد
    expect(studioBlockers('layout', { ...base, from: 'qa', pages: [{ status: 'drafted' }] })).toEqual([]);
  });

  it('الجاهزية تحتاج قايمة الجودة كاملة (والحسّاس بند زيادة)', () => {
    expect(studioBlockers('ready', base)).toHaveLength(1);
    const full = Object.fromEntries(qaItemsFor(false).map((i) => [i.key, true]));
    expect(studioBlockers('ready', { ...base, qaChecklist: full })).toEqual([]);
    expect(studioBlockers('ready', { ...base, qaChecklist: full, sensitiveTopic: true })).toHaveLength(1);
  });
});
