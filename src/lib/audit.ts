import { logAuditAction as writeAuditLog } from '@/data/domains/(admin)/audit/queries';

/**
 * Record an action in the audit trail.
 *
 * This used to push onto an in-memory array, so every entry vanished when the
 * server restarted — the audit log was not actually an audit log. It now
 * writes a row to `audit_logs`.
 *
 * `actorName` is still accepted so existing call sites keep working, but it is
 * not stored: the name is resolved from the actor's profile when the log is
 * read, so renaming a user does not leave a stale name behind in the record.
 */
export async function logAuditAction(params: {
  actorProfileId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    actorProfileId: params.actorProfileId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
  });
}
