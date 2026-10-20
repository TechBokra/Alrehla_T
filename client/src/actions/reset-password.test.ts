import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRecoveredPassword } from './reset-password';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), recovery: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: mocks }) }));
vi.mock('@/lib/recovery-session', () => ({ hasRecoverySession: mocks.recovery }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
  mocks.recovery.mockResolvedValue(true);
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe('password recovery action', () => {
  it('validates minimum length on the server', async () => {
    expect(await resetRecoveredPassword('short', 'short')).toMatchObject({ ok: false, field: 'newPassword' });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('validates confirmation on the server', async () => {
    expect(await resetRecoveredPassword('test-password', 'different')).toMatchObject({ ok: false, field: 'confirmPassword' });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('does not let a normal session bypass the current-password requirement', async () => {
    mocks.recovery.mockResolvedValue(false);
    expect(await resetRecoveredPassword('test-password', 'test-password')).toMatchObject({ ok: false });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('rejects signed-out users', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await resetRecoveredPassword('test-password', 'test-password')).toMatchObject({ ok: false });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('updates and revokes refresh sessions without an admin client', async () => {
    await expect(resetRecoveredPassword('test-password', 'test-password')).rejects.toThrow('NEXT_REDIRECT:/sign-in?passwordReset=success');
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'test-password' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
  it('returns an inline field error and keeps the session when update fails', async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: 'same_password' } });
    expect(await resetRecoveredPassword('test-password', 'test-password')).toMatchObject({ ok: false, field: 'newPassword' });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it('falls back to local logout without misreporting a successful update', async () => {
    mocks.signOut.mockResolvedValueOnce({ error: new Error('unavailable') });
    await expect(resetRecoveredPassword('test-password', 'test-password')).rejects.toThrow('NEXT_REDIRECT:/sign-in?passwordReset=success');
    expect(mocks.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });
});
