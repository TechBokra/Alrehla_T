import { describe, expect, it } from 'vitest';
import {
  deadlineRank,
  deadlineState,
  describeEvent,
  formatSpan,
  pathSteps,
  priorityRank,
  soonLeadMs,
  stepLabel,
  type TaskStep,
  type WorkTaskEvent,
} from './work-tasks';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 16, 10, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe('deadlineState', () => {
  const open = (dueOffsetH: number | null, windowH = 24) => ({
    status: 'open' as const,
    dueAt: dueOffsetH === null ? null : iso(T0 + dueOffsetH * H),
    stepChangedAt: dueOffsetH === null ? null : iso(T0 + dueOffsetH * H - windowH * H),
  });

  it('من غير موعد', () => {
    expect(deadlineState(open(null), T0).kind).toBe('none');
  });

  it('في الميعاد لما المتبقي أكبر من ٢٥٪ من المهلة', () => {
    expect(deadlineState(open(7, 24), T0)).toEqual({ kind: 'ok', ms: 7 * H });
  });

  it('قرب في آخر ٢٥٪ من المهلة (٢٤ ساعة ← ٦ ساعات)', () => {
    expect(deadlineState(open(6, 24), T0).kind).toBe('soon');
    expect(deadlineState(open(5.9, 24), T0).kind).toBe('soon');
    expect(deadlineState(open(6.1, 24), T0).kind).toBe('ok');
  });

  it('حد أدنى ساعتان للنوافذ القصيرة (نافذة ٣ ساعات ← ٢٥٪ = ٤٥ دقيقة لكن التنبيه قبلها بساعتين)', () => {
    expect(soonLeadMs(iso(T0 - 1 * H), iso(T0 + 2 * H))).toBe(2 * H);
    expect(deadlineState(open(1.9, 3), T0).kind).toBe('soon');
    expect(deadlineState(open(2.1, 3), T0).kind).toBe('ok');
  });

  it('فات الموعد: ms = مدة التأخير، والموعد بالظبط = فات', () => {
    expect(deadlineState(open(-3), T0)).toEqual({ kind: 'overdue', ms: 3 * H });
    expect(deadlineState(open(0), T0).kind).toBe('overdue');
  });

  it('المقفولة: في الميعاد / متأخرة / من غير موعد', () => {
    const done = (dueOff: number | null, doneOff: number) => ({
      status: 'done' as const,
      dueAt: dueOff === null ? null : iso(T0 + dueOff * H),
      doneAt: iso(T0 + doneOff * H),
    });
    expect(deadlineState(done(2, 1), T0)).toEqual({ kind: 'done_on_time', ms: 1 * H });
    expect(deadlineState(done(2, 2), T0).kind).toBe('done_on_time');
    expect(deadlineState(done(2, 5), T0)).toEqual({ kind: 'done_late', ms: 3 * H });
    expect(deadlineState(done(null, 5), T0).kind).toBe('done_no_due');
  });

  it('ترتيب الاستعجال', () => {
    expect(deadlineRank('overdue')).toBeLessThan(deadlineRank('soon'));
    expect(deadlineRank('soon')).toBeLessThan(deadlineRank('ok'));
    expect(deadlineRank('ok')).toBeLessThan(deadlineRank('none'));
    expect(priorityRank('urgent')).toBeLessThan(priorityRank('high'));
    expect(priorityRank('normal')).toBeLessThan(priorityRank('low'));
  });
});

describe('formatSpan', () => {
  const n = (x: number) => x.toLocaleString('ar-EG');
  it('دقايق وساعات وأيام بالجمع العربي الصح', () => {
    expect(formatSpan(30_000)).toBe('دقيقة');
    expect(formatSpan(2 * 60_000)).toBe('دقيقتين');
    expect(formatSpan(5 * 60_000)).toBe(`${n(5)} دقايق`);
    expect(formatSpan(45 * 60_000)).toBe(`${n(45)} دقيقة`);
    expect(formatSpan(1 * H)).toBe('ساعة');
    expect(formatSpan(2 * H)).toBe('ساعتين');
    expect(formatSpan(5 * H)).toBe(`${n(5)} ساعات`);
    expect(formatSpan(20 * H)).toBe(`${n(20)} ساعة`);
    expect(formatSpan(48 * H)).toBe('يومين');
    expect(formatSpan(5 * 24 * H)).toBe(`${n(5)} أيام`);
    expect(formatSpan(15 * 24 * H)).toBe(`${n(15)} يوم`);
  });
});

const catalog: TaskStep[] = [
  { line: 'enha_lak', step: 'payment', label: 'مراجعة الدفع', hint: null, slaHours: 24, ownerKind: 'rule', sortOrder: 10, showTab: true },
  { line: 'enha_lak', step: 'fulfilment', label: 'التنفيذ', hint: null, slaHours: 72, ownerKind: 'rule', sortOrder: 20, showTab: true },
  { line: 'enha_lak', step: 'preparing', label: 'قيد التجهيز', hint: null, slaHours: 72, ownerKind: 'rule', sortOrder: 22, showTab: true },
  { line: 'enha_lak', step: 'paid', label: 'بانتظار التجهيز', hint: null, slaHours: 24, ownerKind: 'rule', sortOrder: 21, showTab: true },
  { line: 'courses', step: 'payment', label: 'مراجعة الدفع', hint: null, slaHours: 24, ownerKind: 'rule', sortOrder: 10, showTab: true },
  { line: 'courses', step: 'fulfilment', label: 'التنفيذ', hint: null, slaHours: 72, ownerKind: 'rule', sortOrder: 20, showTab: true },
];

describe('كتالوج المراحل', () => {
  it('اسم المرحلة الدقيقة، وإلا العامة، وإلا الاسم الخام', () => {
    expect(stepLabel(catalog, 'enha_lak', 'preparing', 'fulfilment')).toBe('قيد التجهيز');
    expect(stepLabel(catalog, 'enha_lak', 'fulfilment', 'fulfilment')).toBe('التنفيذ');
    expect(stepLabel(catalog, 'enha_lak', 'unknown_x', 'fulfilment')).toBe('unknown_x');
    expect(stepLabel([], 'enha_lak', 'payment', 'payment')).toBe('مراجعة الدفع');
  });

  it('المسار: الدقيقة بتحلّ محل «التنفيذ» العامة، والعامة بتفضل لو مفيش دقيقة', () => {
    expect(pathSteps(catalog, 'enha_lak').map((s) => s.step)).toEqual(['payment', 'paid', 'preparing']);
    expect(pathSteps(catalog, 'courses').map((s) => s.step)).toEqual(['payment', 'fulfilment']);
  });
});

describe('describeEvent', () => {
  const ctx = {
    personName: (id: string) => ({ a: 'أحمد', b: 'بسمة' })[id],
    stepName: (s: string) => ({ paid: 'بانتظار التجهيز', preparing: 'قيد التجهيز' })[s] ?? s,
    formatTime: (i: string) => `@${i}`,
  };
  const ev = (over: Partial<WorkTaskEvent>): WorkTaskEvent => ({
    id: 1, taskId: 't', kind: 'created', actorId: null, fromValue: null, toValue: null, note: null,
    createdAt: iso(T0), ...over,
  });

  it('النظام لو الفاعل مش إداري معروف', () => {
    expect(describeEvent(ev({ actorId: 'zzz', kind: 'created', toValue: 'paid' }), ctx)).toEqual({
      who: 'النظام',
      text: 'اتفتحت في مرحلة «بانتظار التجهيز»',
    });
  });

  it('التسنيد والمرحلة والإنجاز والملاحظة', () => {
    expect(describeEvent(ev({ actorId: 'a', kind: 'assigned', toValue: 'a,b' }), ctx)).toEqual({
      who: 'أحمد', text: 'اتسندت لـ أحمد، بسمة',
    });
    expect(describeEvent(ev({ kind: 'assigned', fromValue: 'a', toValue: '' }), ctx).text).toBe('اتشال المسؤول — بقت لكل الإدارة');
    expect(describeEvent(ev({ kind: 'step', fromValue: 'paid', toValue: 'preparing' }), ctx).text).toBe(
      'انتقلت من «بانتظار التجهيز» إلى «قيد التجهيز»',
    );
    expect(describeEvent(ev({ kind: 'done', toValue: 'late' }), ctx).text).toBe('اتقفلت بعد الموعد');
    expect(describeEvent(ev({ kind: 'done', toValue: 'on_time' }), ctx).text).toBe('اتقفلت في الميعاد ✓');
    expect(describeEvent(ev({ actorId: 'b', kind: 'note', note: 'بانتظار العميل' }), ctx)).toEqual({
      who: 'بسمة', text: 'بانتظار العميل',
    });
    expect(describeEvent(ev({ kind: 'priority', toValue: 'urgent' }), ctx).text).toBe('الأولوية بقت عاجلة');
    expect(describeEvent(ev({ kind: 'reminder_overdue' }), ctx).who).toBe('النظام');
  });
});
