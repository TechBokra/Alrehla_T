import { describe, expect, it } from 'vitest';
import { MAP_FLOWS, MAP_NODES, detectFindings, type OpsHealth } from './data-map';

const base: OpsHealth = {
  at: '2026-10-27T00:00:00Z', db_size_mb: 23, connections: 19, max_connections: 60, tables: 97, functions: 220,
  triggers: 72, policies: 238,
  tasks: [{ line: 'studio', open: 14, overdue: 14, unassigned: 0, oldest_due: '2026-10-17T00:00:00Z' }],
  studio: { open: 14, no_owner: 14, rules: 0, role_members: 0 },
  rules_by_line: {}, rows: { audit_logs: 900, notifications: 580, notifications_old_read: 0 },
  checks: { audit_index: true, retention: true, autoassign: true, batch_reviews: true },
  slow: [], hot: [],
};

describe('خريطة البيانات', () => {
  it('كل خطوة في المسارات بتشاور على صندوق موجود', () => {
    const ids = new Set(MAP_NODES.map((n) => n.id));
    for (const f of MAP_FLOWS) for (const [a, b] of f.steps) {
      expect(ids.has(a), `${f.id}: ${a}`).toBe(true);
      expect(ids.has(b), `${f.id}: ${b}`).toBe(true);
    }
  });

  it('بيطلّع المشاكل الحالية بس', () => {
    const ids = detectFindings(base).map((f) => f.id);
    expect(ids).toContain('overdue');
    expect(ids).toContain('studio-pool');
    expect(ids).not.toContain('unassigned-studio');
  });

  it('⚠️ اللي اتصلح مابيظهرش: مفيش متأخر ولا ناقص = مفيش نقاط', () => {
    const clean: OpsHealth = { ...base, tasks: [], studio: { ...base.studio, no_owner: 0 } };
    expect(detectFindings(clean)).toEqual([]);
  });

  it('مهام من غير مسؤول = عاجل، والترتيب بالخطورة', () => {
    const f = detectFindings({ ...base, tasks: [{ ...base.tasks[0], unassigned: 3 }] });
    expect(f[0].sev).toBe('high');
  });

  it('عملية بطيئة متكرّرة بتطلع، والنادرة لأ', () => {
    const clean: OpsHealth = { ...base, tasks: [], studio: { ...base.studio, no_owner: 0 } };
    expect(detectFindings({ ...clean, slow: [{ q: 'audit_logs', mean_ms: 300, calls: 50 }] })[0].id).toBe('slow-audit_logs');
    expect(detectFindings({ ...clean, slow: [{ q: 'cron_fn', mean_ms: 300, calls: 5 }] })).toEqual([]);
  });

  it('من غير أرقام: مفيش نقاط (الصفحة بتقول إن الأرقام مش متاحة)', () => {
    expect(detectFindings(null)).toEqual([]);
});
});
