import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orders: vi.fn(),
  createClient: vi.fn(),
  write: vi.fn(),
}));

vi.mock('./orders', () => ({ getAllOrders: mocks.orders }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { getAdminOrdersPageData } from './admin-orders-page';

function makeOrder(id: number) {
  return {
    id: `order-${id}`,
    userId: `user-${id}`,
    items: [{ productId: 'book-1' }],
  } as never;
}

function setupClient() {
  mocks.createClient.mockResolvedValue({
    from: (table: string) => ({
      select() { return this; },
      insert() { mocks.write(); return this; },
      update() { mocks.write(); return this; },
      delete() { mocks.write(); return this; },
      in(_column: string, ids: string[]) {
        const data = table === 'personalized_products'
          ? ids.includes('book-1') ? [{ id: 'book-1', name: 'رحلة', category: 'custom' }] : []
          : ids.map((id) => ({ id, full_name: `Name ${id}` }));
        return Promise.resolve({ data, error: null });
      },
    }),
  });
}

describe('getAdminOrdersPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupClient();
  });

  it('composes order, product, category, and customer data and keeps batching above 1,000 rows', async () => {
    const orders = Array.from({ length: 1001 }, (_, index) => makeOrder(index));
    mocks.orders.mockResolvedValue(orders);

    const result = await getAdminOrdersPageData();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.orders).toHaveLength(1001);
    expect(result.data.productNames['book-1']).toBe('رحلة');
    expect(result.data.productCategories['book-1']).toBe('custom');
    expect(result.data.customerNames['user-1000']).toBe('Name user-1000');
    expect(mocks.orders).toHaveBeenCalledWith({ throwOnError: true });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('returns complete empty data when there are no orders', async () => {
    mocks.orders.mockResolvedValue([]);

    await expect(getAdminOrdersPageData()).resolves.toEqual({
      success: true,
      data: { orders: [], productNames: {}, productCategories: {}, customerNames: {} },
    });
  });

  it('returns LOAD_FAILED rather than a partial list when the order read fails', async () => {
    mocks.orders.mockRejectedValue(new Error('database unavailable'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getAdminOrdersPageData()).resolves.toEqual({
      success: false,
      error: { code: 'LOAD_FAILED', message: 'تعذّر تحميل الطلبات. جرّب تاني.' },
    });
    errorLog.mockRestore();
  });
});
