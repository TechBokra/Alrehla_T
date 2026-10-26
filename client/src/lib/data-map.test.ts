import { describe, expect, it } from 'vitest';
import { MAP_FLOWS, MAP_NODES, hotspotsFrom, type OpsHealth } from './data-map';

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

  it('مهام من غير مسؤول = «محتاج تصليح»، ومن غير ناس للاستوديو = «محتاج خطوة منكم»', () => {
    expect(hotspotsFrom({ ...base, tasks: [{ ...base.tasks[0], unassigned: 3 }] })[0].state).toBe('open');
    expect(hotspotsFrom(base)[0].state).toBe('action');
    expect(hotspotsFrom({ ...base, tasks: [], studio: { ...base.studio, rules: 2 } })[0].state).toBe('fixed');
  });

  it('من غير أرقام: الصفحة بتشتغل والبنود المعتمدة على القاعدة مفتوحة', () => {
    const h = hotspotsFrom(null);
    expect(h).toHaveLength(8);
    expect(h[3].state).toBe('open');
  });
});
