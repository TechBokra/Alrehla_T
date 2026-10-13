import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyServiceOrders } from '@/data/domains/(client)/service-orders/queries';
import { getServiceOrderDetail } from '@/data/domains/(shared)/service-orders/queries';

const mocks = vi.hoisted(() => {
  const state = { orders: [] as Record<string, unknown>[], children: [] as { id: string; full_name: string; birth_date: string | null }[],
    childError: null as null | { code: string }, orderError: null as null | { code: string } };
  const orders = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: state.orders[0] ?? null, error: state.orderError })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.orders, error: state.orderError }).then(resolve),
  };
  const children = { select: vi.fn().mockReturnThis(), in: vi.fn(async (_column: string, ids: string[]) => ({
    data: state.children.filter((child) => ids.includes(child.id)), error: state.childError,
  })) };
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'buyer' } }, error: null })) },
    from: vi.fn((table: string) => table === 'service_orders' ? orders : children) };
  return { state, orders, children, client };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.client }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn() }));

const order = (id: string, childId: string | null = null) => ({ id, buyer_profile_id: 'buyer',
  participant_type: childId ? 'child' : 'self', child_id: childId, amount: 100, status: 'pending',
  standalone_services: { name: 'Service' }, instructors: null,
  service_providers: { display_name: 'Provider', kind: 'platform' } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.orders = [];
  mocks.state.children = [];
  mocks.state.childError = null;
  mocks.state.orderError = null;
});

describe('service-order reads without a child-profile FK', () => {
  it('does not request the unsupported embedded relationship', async () => {
    await getMyServiceOrders({ throwOnError: true });
    expect(mocks.orders.select.mock.calls[0][0]).not.toContain('child_profiles(');
    expect(mocks.orders.eq).toHaveBeenCalledWith('buyer_profile_id', 'buyer');
  });
  it('does not query child profiles for self orders', async () => {
    mocks.state.orders = [order('self')];
    expect(await getMyServiceOrders()).toMatchObject([{ participantType: 'self', participantName: null }]);
    expect(mocks.children.in).not.toHaveBeenCalled();
  });
  it('loads unique participants in one batch and preserves provider data', async () => {
    mocks.state.orders = [order('one', 'child'), order('two', 'child')];
    mocks.state.children = [{ id: 'child', full_name: 'Child', birth_date: '2016-01-01' }];
    const result = await getMyServiceOrders({ throwOnError: true });
    expect(mocks.children.in).toHaveBeenCalledTimes(1);
    expect(mocks.children.in).toHaveBeenCalledWith('id', ['child']);
    expect(mocks.children.select).toHaveBeenCalledWith('id, full_name, birth_date');
    expect(result[0]).toMatchObject({ participantName: 'Child', participantBirthDate: '2016-01-01',
      providerName: 'Provider', serviceName: 'Service' });
  });
  it('keeps orders whose child profile was deleted or is hidden by RLS', async () => {
    mocks.state.orders = [order('one', 'missing-child')];
    expect(await getMyServiceOrders({ throwOnError: true })).toMatchObject([{ id: 'one', participantName: null, participantBirthDate: null }]);
  });
  it('propagates lookup failures to the account query error contract', async () => {
    mocks.state.orders = [order('one', 'child')];
    mocks.state.childError = { code: '42501' };
    await expect(getMyServiceOrders({ throwOnError: true })).rejects.toEqual({ code: '42501' });
  });
  it('preserves the default optional participant fallback for other callers', async () => {
    mocks.state.orders = [order('one', 'child')];
    mocks.state.childError = { code: '42501' };
    expect(await getMyServiceOrders()).toMatchObject([{ id: 'one', participantName: null }]);
  });
  it('bounds large lookups instead of issuing one query per order', async () => {
    mocks.state.orders = Array.from({ length: 201 }, (_, index) => order(`order-${index}`, `child-${index}`));
    expect(await getMyServiceOrders()).toHaveLength(201);
    expect(mocks.children.in).toHaveBeenCalledTimes(2);
    expect(mocks.children.in.mock.calls[0][1]).toHaveLength(200);
    expect(mocks.children.in.mock.calls[1][1]).toHaveLength(1);
  });
  it('uses the same corrected participant lookup on the detail reader', async () => {
    mocks.state.orders = [order('one', 'child')];
    mocks.state.children = [{ id: 'child', full_name: 'Child', birth_date: null }];
    expect(await getServiceOrderDetail('one')).toMatchObject({ id: 'one', participantName: 'Child' });
  });
});
