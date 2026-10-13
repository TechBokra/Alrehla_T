import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPasswordReset } from './auth';
const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: mocks }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://www.alrehla.org' }) }));
vi.mock("@/data/domains/(shared)/auth/queries", () => ({ syncUserProfile: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
});
describe('password reset requests', () => {
  it('validates email before contacting Supabase', async () => {
    expect(await requestPasswordReset('invalid')).toHaveProperty('error');
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('trims email and uses the secure recovery callback', async () => {
    expect(await requestPasswordReset(' test@example.com ')).toHaveProperty('notice');
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: 'https://www.alrehla.org/auth/callback?next=%2Freset-password',
    });
  });
  it('does not expose provider errors or account existence', async () => {
    const success = await requestPasswordReset('test@example.com');
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429 } });
    expect(await requestPasswordReset('test@example.com')).toEqual(success);
  });
  it('handles a rejected connection without leaking details', async () => {
    const success = await requestPasswordReset('test@example.com');
    mocks.resetPasswordForEmail.mockRejectedValue(new Error('provider unavailable'));
    expect(await requestPasswordReset('test@example.com')).toEqual(success);
  });
});
