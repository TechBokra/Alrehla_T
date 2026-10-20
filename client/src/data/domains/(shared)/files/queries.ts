import 'server-only';
import type { QueryResult } from '@/data/query-result';
import { createClient } from '@/lib/supabase/server';
import { readPrivateFileRetentionDays } from '@/data/domains/(shared)/files/settings';
import { fetchAllPages } from '@/lib/fetch-all';
import { fileExpiryDate, CLOSED_ORDER_STATUSES } from '@/lib/private-files';

/** File data safe for rendering; provider locators never leave server actions. */
export type PrivateFileView = {
  id: string;
  fileName: string;
  bytes: number;
  createdAt: string;
  fromProvider: boolean;
  uploadedByMe: boolean;
  canDelete: boolean;
  state: 'active' | 'delete_pending' | 'deleted';
  deletionReason: string | null;
  /** Compatibility convenience for retention labels. */
  deleted: boolean;
  expiresAt: string | null;
};

type Row = {
  id: string;
  file_name: string;
  bytes: number;
  created_at: string;
  is_delivery: boolean;
  uploader_profile_id: string;
  lifecycle_state: PrivateFileView['state'];
  deletion_reason: string | null;
};

type FileRead = QueryResult<{ files: PrivateFileView[]; retentionDays: number }, 'LOAD_FAILED'>;

async function listFiles(
  column: 'order_id' | 'document_id',
  id: string,
  owner: { closed: boolean; closedAt?: string | null },
  manageAll = false,
): Promise<FileRead> {
  try {
    const supabase = await createClient();
    const [{ data: { user }, error: authError }, retentionDays, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      readPrivateFileRetentionDays(supabase),
      fetchAllPages((from, to) => supabase
        .from('private_files')
        .select('id, file_name, bytes, created_at, is_delivery, uploader_profile_id, lifecycle_state, deletion_reason')
        .eq(column, id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }).range(from, to)),
    ]);
    if (authError || !user || error || !data) {
      console.error('Private file list read failed', { authError, error });
      return { success: false, error: { code: 'LOAD_FAILED', message: 'تعذّر تحميل الملفات. حدّث الصفحة أو حاول تاني.' } };
    }

    const files = (data as Row[])
      // A user deletion is hidden after provider confirmation. Retention tombstones stay visible.
      .filter((file) => file.lifecycle_state !== 'deleted' || file.deletion_reason === 'retention')
      .map((file) => ({
        id: file.id,
        fileName: file.file_name,
        bytes: file.bytes,
        createdAt: file.created_at,
        fromProvider: file.is_delivery,
        uploadedByMe: file.uploader_profile_id === user?.id,
        canDelete: file.lifecycle_state === 'active' && (file.uploader_profile_id === user?.id || manageAll),
        state: file.lifecycle_state,
        deletionReason: file.deletion_reason,
        deleted: file.lifecycle_state === 'deleted',
        expiresAt: fileExpiryDate({ createdAt: file.created_at }, owner, retentionDays)?.toISOString() ?? null,
      }));
    return { success: true, data: { files, retentionDays } };
  } catch (error) {
    console.error('Private file list query failed', error);
    return { success: false, error: { code: 'LOAD_FAILED', message: 'تعذّر تحميل الملفات. حدّث الصفحة أو حاول تاني.' } };
  }
}

export function getOrderFiles(order: { id: string; status: string; completedAt?: string | null }): Promise<FileRead> {
  const closed = (CLOSED_ORDER_STATUSES as readonly string[]).includes(order.status);
  return listFiles('order_id', order.id, { closed, closedAt: order.completedAt ?? null });
}

export function getDocumentFiles(
  doc: { id: string; status: string; updatedAt?: string | null },
  options: { manageAll?: boolean } = {},
): Promise<FileRead> {
  const closed = doc.status === 'reviewed';
  return listFiles('document_id', doc.id, { closed, closedAt: closed ? doc.updatedAt ?? null : null }, options.manageAll);
}
