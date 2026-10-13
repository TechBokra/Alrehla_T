import 'server-only';
import type { StorageLocator } from '@/lib/attachments/types';
import { isAdminApiConfigured, createAdminClient } from '@/lib/supabase/admin';
import { getAttachmentStorageProvider } from '@/lib/attachments/provider';
import { readPrivateFileRetentionDays } from '@/data/domains/(shared)/files/settings';
import type { Json } from '@/types/supabase';

export type PrivateFileCleanupCounts = {
  queued: number;
  attempted: number;
  completed: number;
  failed: number;
  pending: number;
};

type CleanupJob = {
  id: string;
  lease_token: string;
  provider: string;
  provider_locator: Record<string, unknown>;
  file_id: string | null;
  intent_id: string | null;
  deletion_reason: string;
};

function locatorFrom(value: Record<string, unknown>): StorageLocator | null {
  if (
    typeof value.public_id !== 'string' ||
    (value.resource_type !== 'image' && value.resource_type !== 'raw') ||
    value.type !== 'authenticated'
  ) return null;
  return {
    public_id: value.public_id,
    resource_type: value.resource_type,
    type: 'authenticated',
    ...(typeof value.folder === 'string' ? { folder: value.folder } : {}),
    ...(typeof value.tag === 'string' ? { tag: value.tag } : {}),
  };
}

export async function runPrivateFilesCleanup(now = new Date()): Promise<
  | ({ ok: true } & PrivateFileCleanupCounts)
  | ({ ok: false; error: string } & PrivateFileCleanupCounts)
> {
  const counts: PrivateFileCleanupCounts = { queued: 0, attempted: 0, completed: 0, failed: 0, pending: 0 };
  if (!isAdminApiConfigured()) {
    return { ok: false, error: 'Supabase service credentials are missing', ...counts };
  }
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Supabase configuration is invalid', ...counts };
  }
  let provider;
  try {
    provider = getAttachmentStorageProvider();
    if (!provider.isConfigured()) return { ok: false, error: 'Cloudinary credentials are missing', ...counts };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Attachment provider is unavailable', ...counts };
  }

  let retentionDays: number;
  try {
    retentionDays = await readPrivateFileRetentionDays(admin);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not load retention settings', ...counts };
  }

  let claim: Json | null = null;
  let claimError: { message: string } | null = null;
  try {
    const response = await admin.rpc('claim_private_file_cleanup_jobs', {
      p_now: now.toISOString(),
      p_retention_days: retentionDays,
      p_limit: 300,
    });
    claim = response.data;
    claimError = response.error;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not claim cleanup jobs', ...counts };
  }
  if (claimError || !claim || typeof claim !== 'object' || Array.isArray(claim)) {
    return { ok: false, error: claimError?.message ?? 'Could not claim cleanup jobs', ...counts };
  }
  const claimed = claim as { queued_count?: number; jobs?: CleanupJob[] };
  if (!Array.isArray(claimed.jobs) || !Number.isInteger(claimed.queued_count) || Number(claimed.queued_count) < 0) {
    return { ok: false, error: 'Cleanup RPC returned an invalid claim response', ...counts };
  }
  counts.queued = Number(claimed.queued_count);
  const jobs = claimed.jobs;
  counts.attempted = jobs.length;

  const processJob = async (job: CleanupJob): Promise<'completed' | 'failed'> => {
    let success = false;
    let failure = '';
    try {
      if (job.provider !== provider.name) throw new Error(`Unsupported provider ${job.provider}`);
      const locator = locatorFrom(job.provider_locator);
      if (!locator) throw new Error('Cleanup job has an invalid provider locator');

      if (job.deletion_reason === 'reconcile_unexpected') {
        if (!locator.tag) throw new Error('Reconciliation job has no upload intent tag');
        const taggedAssets = await provider.findAssetsByIntentTag(locator.tag);
        const { data: registered, error: readError } = await admin.from('private_files')
          .select('lifecycle_state').eq('upload_intent_id', job.intent_id ?? '').maybeSingle();
        if (readError) throw new Error('Could not verify the registered attachment before reconciliation');
        // A signature can be replayed after an early user deletion. Preserve
        // the canonical destination only while its registered file still exists.
        const preserveRegistered = registered && registered.lifecycle_state !== 'deleted';
        const unexpected = taggedAssets.filter((asset) =>
          !preserveRegistered || asset.publicId !== locator.public_id || asset.resourceType !== locator.resource_type,
        );
        for (const asset of unexpected) {
          await provider.deleteAsset({
            public_id: asset.publicId,
            resource_type: asset.resourceType,
            type: 'authenticated',
          });
        }
        success = true;
      } else {
        if (locator.tag && ['abandoned_upload', 'invalid_upload', 'parent_deleted'].includes(job.deletion_reason)) {
          // resource_type is excluded from Cloudinary signatures. An abandoned
          // ticket can therefore leave tagged assets under a different type.
          const taggedAssets = await provider.findAssetsByIntentTag(locator.tag);
          for (const asset of taggedAssets) {
            await provider.deleteAsset({ public_id: asset.publicId,
              resource_type: asset.resourceType, type: 'authenticated' });
          }
        }
        await provider.deleteAsset(locator);
        success = true;
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Provider deletion failed';
    }

    try {
      const { data: completed, error: completionError } = await admin.rpc('complete_private_file_cleanup_job', {
        p_job_id: job.id,
        p_claim_token: job.lease_token,
        p_success: success,
        p_error: failure || undefined,
        p_now: new Date().toISOString(),
      });
      if (completionError || completed !== true) {
        console.error('Private file cleanup job completion failed', { id: job.id, completionError });
        return 'failed';
      }
      return success ? 'completed' : 'failed';
    } catch (error) {
      console.error('Private file cleanup job completion threw', { id: job.id, error });
      return 'failed';
    }
  };

  // Keep the worker below the cron duration while avoiding a burst of hundreds
  // of concurrent Cloudinary and Postgres requests.
  for (let offset = 0; offset < jobs.length; offset += 12) {
    const outcomes = await Promise.all(jobs.slice(offset, offset + 12).map(processJob));
    counts.completed += outcomes.filter((outcome) => outcome === 'completed').length;
    counts.failed += outcomes.filter((outcome) => outcome === 'failed').length;
  }

  let count: number | null = null;
  let pendingError: { message: string } | null = null;
  try {
    const response = await admin
      .from('private_file_cleanup_jobs')
      .select('id', { count: 'exact', head: true })
      .neq('state', 'completed');
    count = response.count;
    pendingError = response.error;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not count pending cleanup jobs', ...counts };
  }
  if (pendingError || count == null) {
    return { ok: false, error: pendingError?.message ?? 'Could not count pending cleanup jobs', ...counts };
  }
  counts.pending = count ?? 0;
  if (counts.failed > 0) return { ok: false, error: 'One or more attachment cleanup jobs failed', ...counts };
  return { ok: true, ...counts };
}
