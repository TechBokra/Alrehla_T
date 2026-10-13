import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, readPrivateFileRetentionDays } = vi.hoisted(() => ({
  createClient: vi.fn(),
  readPrivateFileRetentionDays: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock("@/data/domains/(shared)/files/settings", () => ({ readPrivateFileRetentionDays }));

import { getOrderFiles } from '@/data/domains/(shared)/files/queries';

function clientWithFileQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => Promise.resolve({ ...result,
      data: Array.isArray(result.data) ? result.data.slice(from, to + 1) : result.data })),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'buyer-1' } }, error: null }) },
    from: vi.fn(() => query),
  };
}

describe('private file read model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readPrivateFileRetentionDays.mockResolvedValue(30);
  });

  it('returns an empty list as a successful read', async () => {
    createClient.mockResolvedValue(clientWithFileQuery({ data: [], error: null }));

    const result = await getOrderFiles({ id: 'order-1', status: 'paid' });

    expect(result).toEqual({ success: true, data: { files: [], retentionDays: 30 } });
  });

  it('keeps a failed query distinct from an empty list', async () => {
    createClient.mockResolvedValue(clientWithFileQuery({ data: null, error: { message: 'permission denied' } }));

    const result = await getOrderFiles({ id: 'order-1', status: 'paid' });

    expect(result).toMatchObject({ success: false, error: { code: 'LOAD_FAILED' } });
  });

  it('does not truncate a large attachment list and preserves delete-pending state', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `file-${index}`,
      file_name: `file-${index}.pdf`,
      bytes: 200,
      created_at: '2026-10-01T00:00:00.000Z',
      is_delivery: false,
      uploader_profile_id: 'buyer-1',
      lifecycle_state: index === 1000 ? 'delete_pending' : 'active',
      deletion_reason: null,
    }));
    createClient.mockResolvedValue(clientWithFileQuery({ data: rows, error: null }));

    const result = await getOrderFiles({ id: 'order-1', status: 'paid' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toHaveLength(1001);
      expect(result.data.files[1000]).toMatchObject({ state: 'delete_pending', canDelete: false });
    }
  });
});
