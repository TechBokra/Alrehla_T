import { AuditLog } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const AUDIT_PAGE_SIZE = 100;

/**
 * صفحة من سجل التدقيق — الأحدث الأول.
 *
 * ⚠️ كانت آخر 200 صف مرة واحدة من غير فهرس على التاريخ (أبطأ استعلام في
 *    الموقع — خريطة البيانات، ٢٧ أكتوبر). دلوقتي صفحات + فهرس
 *    `audit_logs_created_at_idx`، وبنجيب صف زيادة عشان نعرف فيه «التالي» من
 *    غير ما نعدّ الجدول كله.
 */
export async function getAuditLogs(
  page = 1,
  size = AUDIT_PAGE_SIZE,
): Promise<{ logs: AuditLog[]; hasNext: boolean }> {
  const supabase = await createClient();
  const from = (Math.max(1, page) - 1) * size;
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_profile_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .range(from, from + size);

  if (error || !data) return { logs: [], hasNext: false };

  const rows = data.slice(0, size);
  const ids = [...new Set(rows.map((r) => r.actor_profile_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabase.from('user_profiles').select('id, full_name').in('id', ids);
    for (const p of people ?? []) names.set(p.id, p.full_name ?? '');
  }

  return {
    hasNext: data.length > size,
    logs: rows.map((row) => ({
      id: row.id,
      actorProfileId: row.actor_profile_id ?? undefined,
      actorName: row.actor_profile_id ? names.get(row.actor_profile_id) || undefined : undefined,
      action: row.action,
      entityType: row.entity_type ?? '',
      entityId: row.entity_id ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Writes a real audit entry. This used to push onto an in-memory array, which
 * meant every recorded action was lost the moment the server restarted — the
 * audit log was, in effect, not an audit log.
 */
export async function logAuditAction(
  data: Omit<import('@/types').AuditLog, 'id' | 'createdAt'>
) {
  const supabase = await createClient();
  const { error } = await supabase.from('audit_logs').insert({
    actor_profile_id: data.actorProfileId ?? null,
    action: data.action,
    entity_type: data.entityType ?? null,
    entity_id: data.entityId ?? null,
    metadata: (data.metadata as never) ?? null,
  });
  if (error) console.error('Error writing audit log', error);
}
