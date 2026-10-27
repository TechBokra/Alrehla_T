import { describe, expect, it } from 'vitest';
import { joinFollowUp, lastMessages } from './join-followup';

const now = Date.parse('2026-10-27T10:00:00Z');
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
const req = { status: 'pending', createdAt: ago(10) };

describe('متابعة طلبات الانضمام', () => {
  it('⚠️ رديت ومستني المتقدّم من قريب = مش محتاج تصرّف (مايظهرش في المهام)', () => {
    expect(joinFollowUp(req, { author: 'admin', createdAt: ago(1) }, now).needsAction).toBe(false);
  });
  it('رد جديد من المتقدّم = محتاج تصرّف', () => {
    const f = joinFollowUp(req, { author: 'applicant', createdAt: ago(0) }, now);
    expect(f.kind).toBe('replied');
    expect(f.needsAction).toBe(true);
  });
  it('مفيش رد مننا = جديد، ويتعلّم متأخر بعد يومين', () => {
    expect(joinFollowUp({ ...req, createdAt: ago(0) }, null, now)).toMatchObject({ kind: 'new', late: false });
    expect(joinFollowUp(req, null, now)).toMatchObject({ kind: 'new', late: true });
  });
  it('المتقدّم اتأخر 3 أيام = متابعة', () => {
    expect(joinFollowUp(req, { author: 'admin', createdAt: ago(4) }, now)).toMatchObject({ kind: 'stale', needsAction: true });
  });
  it('المقبول والمرفوض مقفولين', () => {
    expect(joinFollowUp({ ...req, status: 'approved' }, null, now).needsAction).toBe(false);
  });
  it('آخر رسالة لكل طلب', () => {
    const m = lastMessages([
      { request_id: 'a', author: 'admin', created_at: ago(3) },
      { request_id: 'a', author: 'applicant', created_at: ago(1) },
    ]);
    expect(m.get('a')?.author).toBe('applicant');
  });
});
