import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireUser,
  createClient,
  createAdminClient,
  isAdminApiConfigured,
  getAttachmentStorageProvider,
  providerDeleteAsset,
  rpc,
  getInstructorUserId,
  revalidatePath,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isAdminApiConfigured: vi.fn(),
  getAttachmentStorageProvider: vi.fn(),
  providerDeleteAsset: vi.fn(),
  rpc: vi.fn(),
  getInstructorUserId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({ requireUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient, isAdminApiConfigured }));
vi.mock('@/lib/attachments/provider', () => ({
  getAttachmentStorageProvider,
}));
vi.mock('@/lib/notifications', () => ({
  notifyUser: vi.fn(),
  getInstructorUserId,
  getProviderUserId: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath }));

import { deletePrivateFile, getDocumentFileTicket, getOrderFileTicket, getPrivateFileLink, registerOrderFile } from './private-files';

function userClient(rows: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn().mockResolvedValue({ data: rows[table] ?? null, error: null }),
      };
      return query;
    }),
  };
}

describe('private-file server actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAdminApiConfigured.mockReturnValue(true);
    rpc.mockResolvedValue({ data: null, error: { message: 'Upload is not authorized or the parent is not eligible' } });
    createAdminClient.mockReturnValue({ rpc });
    getAttachmentStorageProvider.mockReturnValue({ deleteAsset: providerDeleteAsset });
  });

  it('does not issue an upload reservation to an administrator', async () => {
    requireUser.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    createClient.mockResolvedValue(userClient({
      service_orders: {
        id: 'order-1',
        status: 'paid',
        buyer_profile_id: 'admin-1',
        instructor_id: null,
        provider_id: null,
        standalone_service_id: 'service-1',
      },
      standalone_services: { allows_files: true, file_kinds: ['pdf'], file_max_mb: 10 },
    }));

    const result = await getOrderFileTicket('order-1', { fileName: 'brief.pdf', bytes: 200 });

    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledWith('create_private_file_upload_intent', expect.objectContaining({
      p_actor_id: 'admin-1',
      p_owner_id: 'order-1',
    }));
    expect(getAttachmentStorageProvider).not.toHaveBeenCalled();
  });

  it('rejects new files on a reviewed document before issuing an intent', async () => {
    requireUser.mockResolvedValue({ id: 'writer-1', role: 'student' });
    createClient.mockResolvedValue(userClient({
      portfolio_documents: { id: 'doc-1', student_id: 'writer-1', status: 'reviewed' },
    }));

    const result = await getDocumentFileTicket('doc-1', { fileName: 'draft.pdf', bytes: 200 });

    expect(result).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not contact storage if the durable deletion transaction fails', async () => {
    requireUser.mockResolvedValue({ id: 'uploader-1', role: 'customer' });
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });

    const result = await deletePrivateFile('file-1');

    expect(result).toMatchObject({ ok: false });
    expect(providerDeleteAsset).not.toHaveBeenCalled();
  });

  it('keeps a deletion pending when Cloudinary does not confirm the delete', async () => {
    requireUser.mockResolvedValue({ id: 'uploader-1', role: 'customer' });
    rpc
      .mockResolvedValueOnce({ data: {
        ok: true,
        state: 'pending',
        job_id: 'job-1',
        claim_token: 'claim-1',
        locator: { public_id: 'private/file-1', resource_type: 'raw', type: 'authenticated' },
      }, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    providerDeleteAsset.mockRejectedValue(new Error('provider unavailable'));
    const privateFilesQuery = {
      select: vi.fn(() => privateFilesQuery),
      eq: vi.fn(() => privateFilesQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { order_id: 'order-1', document_id: null }, error: null }),
    };
    createAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => privateFilesQuery),
    });

    const result = await deletePrivateFile('file-1');

    expect(result).toEqual({ ok: true, deletionState: 'pending' });
    expect(rpc).toHaveBeenLastCalledWith('complete_private_file_cleanup_job', expect.objectContaining({
      p_job_id: 'job-1',
      p_claim_token: 'claim-1',
      p_success: false,
      p_error: 'provider unavailable',
    }));
    expect(privateFilesQuery.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns the saved file on retry even after the service disables uploads', async () => {
    requireUser.mockResolvedValue({ id: 'buyer-1', role: 'customer' });
    createClient.mockResolvedValue(userClient({ service_orders: {
      id: 'order-1', buyer_profile_id: 'buyer-1', status: 'completed', standalone_service_id: 'service-1',
    }, standalone_services: { allows_files: false } }));
    createAdminClient.mockReturnValue({ rpc, ...userClient({
      private_file_upload_intents: { id: 'intent-1', owner_kind: 'order', owner_id: 'order-1',
        uploader_profile_id: 'buyer-1', lifecycle_state: 'finalized', file_name: 'brief.pdf' },
      private_files: { id: 'file-1' },
    }) });
    await expect(registerOrderFile('order-1', 'intent-1')).resolves.toEqual({ ok: true, fileId: 'file-1' });
    expect(getAttachmentStorageProvider).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps registration successful when the notification recipient lookup fails', async () => {
    requireUser.mockResolvedValue({ id: 'buyer-1', role: 'customer' });
    createClient.mockResolvedValue(userClient({ service_orders: {
      id: 'order-1', buyer_profile_id: 'buyer-1', instructor_id: 'instructor-1', status: 'paid',
    } }));
    createAdminClient.mockReturnValue({ rpc, ...userClient({
      private_file_upload_intents: { id: 'intent-1', owner_kind: 'order', owner_id: 'order-1',
        uploader_profile_id: 'buyer-1', lifecycle_state: 'reserved', file_name: 'brief.pdf',
        provider_locator: { public_id: 'private/intent.pdf', resource_type: 'raw', type: 'authenticated' } },
    }) });
    getAttachmentStorageProvider.mockReturnValue({ getAsset: vi.fn().mockResolvedValue({
      publicId: 'private/intent.pdf', resourceType: 'raw', deliveryType: 'authenticated',
      folder: 'private', format: 'pdf', bytes: 200, tags: ['intent-tag'],
    }) });
    rpc.mockResolvedValue({ data: { ok: true, file_id: 'file-1', already_finalized: false }, error: null });
    getInstructorUserId.mockRejectedValue(new Error('notification lookup failed'));
    await expect(registerOrderFile('order-1', 'intent-1')).resolves.toEqual({ ok: true, fileId: 'file-1' });
  });

  it('keeps deletion successful and queued when its completion write throws', async () => {
    requireUser.mockResolvedValue({ id: 'buyer-1', role: 'customer' });
    createAdminClient.mockReturnValue({ rpc, ...userClient({ private_files: { order_id: 'order-1' } }) });
    rpc.mockResolvedValueOnce({ data: { ok: true, job_id: 'job-1', claim_token: 'claim-1',
      locator: { public_id: 'private/file', resource_type: 'image', type: 'authenticated' } }, error: null })
      .mockRejectedValueOnce(new Error('database connection lost'));
    providerDeleteAsset.mockResolvedValue('deleted');
    revalidatePath.mockImplementation(() => { throw new Error('cache unavailable'); });
    await expect(deletePrivateFile('file-1')).resolves.toEqual({ ok: true, deletionState: 'pending' });
    expect(providerDeleteAsset).toHaveBeenCalledOnce();
  });

  it('never generates a new download link for a file pending deletion', async () => {
    requireUser.mockResolvedValue({ id: 'buyer-1', role: 'customer' });
    createClient.mockResolvedValue(userClient({ private_files: { lifecycle_state: 'delete_pending' } }));
    await expect(getPrivateFileLink('file-1')).resolves.toMatchObject({ ok: false });
    expect(getAttachmentStorageProvider).not.toHaveBeenCalled();
  });
});
