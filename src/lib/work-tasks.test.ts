import { describe, expect, it } from 'vitest';
import {
  WORK_LINES,
  WORK_LINE_LABELS,
  WORK_LINE_STAGES,
  WORK_STAGES,
  isStageOfLine,
  isWorkLine,
  workStageHint,
} from './work-tasks';

describe('work-tasks — خطوط المهام', () => {
  it('كل خط ليه اسم ومراحل صالحة', () => {
    for (const l of WORK_LINES) {
      expect(WORK_LINE_LABELS[l]).toBeTruthy();
      expect(WORK_LINE_STAGES[l].length).toBeGreaterThan(0);
      for (const s of WORK_LINE_STAGES[l]) expect(WORK_STAGES).toContain(s);
    }
  });

  it('الاستوديو مرحلة واحدة (التنفيذ) ومعروف كخط', () => {
    expect(isWorkLine('studio')).toBe(true);
    expect(WORK_LINE_STAGES.studio).toEqual(['fulfilment']);
    expect(isStageOfLine('studio', 'payment')).toBe(false);
    expect(isStageOfLine('studio', 'fulfilment')).toBe(true);
  });

  it('الخطوط القديمة لسه بمرحلتين', () => {
    for (const l of ['enha_lak', 'box', 'courses', 'services'] as const) {
      expect(WORK_LINE_STAGES[l]).toEqual(['payment', 'fulfilment']);
    }
  });

  it('شرح خاص للاستوديو وعادي لغيره', () => {
    expect(workStageHint('studio', 'fulfilment')).toMatch(/مسؤولو الإنتاج/);
    expect(workStageHint('enha_lak', 'payment')).toMatch(/الإيصال/);
  });
});
