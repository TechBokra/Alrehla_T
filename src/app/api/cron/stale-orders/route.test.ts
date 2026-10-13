import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({})),
  isAdminApiConfigured: vi.fn(() => true),
  getSiteSettings: vi.fn(),
  cancelStalePendingOrders: vi.fn(),
  deliverStaleOrderNotifications: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
  isAdminApiConfigured: mocks.isAdminApiConfigured,
}));
vi.mock("@/data/domains/(shared)/settings/queries", () => ({ getSiteSettings: mocks.getSiteSettings }));
vi.mock('@/lib/stale-orders', () => ({
  cancelStalePendingOrders: mocks.cancelStalePendingOrders,
  deliverStaleOrderNotifications: mocks.deliverStaleOrderNotifications,
}));

import { GET } from './route';

describe('stale-orders cron', () => {
  const previousSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mocks.getSiteSettings.mockResolvedValue({ pendingOrderCancelDays: 7 });
    mocks.cancelStalePendingOrders.mockResolvedValue({ ok: true, cancelled: 2 });
    mocks.deliverStaleOrderNotifications.mockResolvedValue({ delivered: 1, failed: 0, pending: 0 });
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  it('retries notices even when cancellation fails and returns a failed response', async () => {
    mocks.cancelStalePendingOrders.mockResolvedValue({ ok: false, error: 'database unavailable' });
    const request = new Request('http://localhost/api/cron/stale-orders', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ cancellationError: 'database unavailable', delivered: 1 });
    expect(mocks.deliverStaleOrderNotifications).toHaveBeenCalledTimes(1);
  });

  it('still retries notices when cancellation is disabled', async () => {
    mocks.getSiteSettings.mockResolvedValue({ pendingOrderCancelDays: 0 });
    mocks.cancelStalePendingOrders.mockResolvedValue({ ok: true, cancelled: 0 });
    const request = new Request('http://localhost/api/cron/stale-orders', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.cancelStalePendingOrders).toHaveBeenCalledWith(expect.anything(), 0);
    expect(mocks.deliverStaleOrderNotifications).toHaveBeenCalledTimes(1);
  });
});
