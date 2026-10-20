import { AuditLog } from '@/types';
import { createClient } from '@/lib/supabase/server';

export async function getAuditLogs(): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_profile_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    actorProfileId: row.actor_profile_id ?? undefined,
    action: row.action,
    entityType: row.entity_type ?? '',
    entityId: row.entity_id ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.created_at,
  }));
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
