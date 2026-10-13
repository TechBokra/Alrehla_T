import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(), isAdminApiConfigured: vi.fn(),
  getAttachmentStorageProvider: vi.fn(), readPrivateFileRetentionDays: vi.fn(),
  rpc: vi.fn(), deleteAsset: vi.fn(), findAssetsByIntentTag: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => mocks);
vi.mock('@/lib/attachments/provider', () => mocks);
vi.mock("@/data/domains/(shared)/files/settings", () => mocks);
import { runPrivateFilesCleanup } from '@/data/domains/(admin)/files/cleanup';

const locator = { public_id: 'private/intent.pdf', resource_type: 'raw', type: 'authenticated', tag: 'intent-tag' };
function setupJob(reason: string, registeredState: string | null = 'active') {
  mocks.rpc.mockImplementation(async (name: string) => name === 'claim_private_file_cleanup_jobs'
    ? { data: { queued_count: 1, jobs: [{ id: 'job-1', lease_token: 'token-1', provider: 'cloudinary',
      provider_locator: locator, file_id: null, intent_id: 'intent-1', deletion_reason: reason }] }, error: null }
    : { data: true, error: null });
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc, from: (table: string) => {
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: registeredState ? { lifecycle_state: registeredState } : null, error: null }),
      neq: async () => ({ count: table === 'private_file_cleanup_jobs' ? 0 : null, error: null }),
    };
    return query;
  } });
}

describe('durable private attachment cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isAdminApiConfigured.mockReturnValue(true);
    mocks.readPrivateFileRetentionDays.mockResolvedValue(30);
    mocks.getAttachmentStorageProvider.mockReturnValue({ name: 'cloudinary', isConfigured: () => true,
      deleteAsset: mocks.deleteAsset, findAssetsByIntentTag: mocks.findAssetsByIntentTag });
    mocks.deleteAsset.mockResolvedValue('deleted');
    mocks.findAssetsByIntentTag.mockResolvedValue([
      { publicId: locator.public_id, resourceType: 'raw' },
      { publicId: 'private/extra', resourceType: 'image' },
    ]);
    setupJob('abandoned_upload');
  });

  it('does not queue destructive cleanup using fallback settings after a failed read', async () => {
    mocks.readPrivateFileRetentionDays.mockRejectedValue(new Error('settings unavailable'));
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: false, attempted: 0 });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deleteAsset).not.toHaveBeenCalled();
  });

  it('removes assets from every resource type used by an abandoned intent', async () => {
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: true, completed: 1 });
    expect(mocks.deleteAsset).toHaveBeenCalledWith(expect.objectContaining({
      public_id: 'private/extra', resource_type: 'image',
    }));
  });

  it('preserves the registered asset during reconciliation', async () => {
    setupJob('reconcile_unexpected', 'active');
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: true, completed: 1 });
    expect(mocks.deleteAsset).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAsset).toHaveBeenCalledWith(expect.objectContaining({ public_id: 'private/extra' }));
  });

  it('removes a ticket replay after the registered file was deleted', async () => {
    setupJob('reconcile_unexpected', 'deleted');
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: true, completed: 1 });
    expect(mocks.deleteAsset).toHaveBeenCalledWith(expect.objectContaining({ public_id: locator.public_id }));
    expect(mocks.deleteAsset).toHaveBeenCalledTimes(2);
  });

  it('retains a partially failed cleanup for another run', async () => {
    mocks.deleteAsset.mockResolvedValueOnce('deleted').mockRejectedValueOnce(new Error('provider unavailable'));
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: false, failed: 1, completed: 0 });
    expect(mocks.rpc).toHaveBeenLastCalledWith('complete_private_file_cleanup_job', expect.objectContaining({
      p_job_id: 'job-1', p_claim_token: 'token-1', p_success: false, p_error: 'provider unavailable',
    }));
    mocks.deleteAsset.mockResolvedValue('not_found');
    expect(await runPrivateFilesCleanup()).toMatchObject({ ok: true, completed: 1 });
  });
});
