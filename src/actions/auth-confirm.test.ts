import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) },
    }),
}));

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (p: string) => redirect(p) }));

import { confirmInvite } from './auth-confirm';

function form(token?: string) {
  const fd = new FormData();
  if (token !== undefined) fd.set('token_hash', token);
  return fd;
}

describe('confirmInvite — رابط الدعوة', () => {
  beforeEach(() => vi.clearAllMocks());

  it('رابط من غير رمز يترفض من غير ما يكلّم Supabase', async () => {
    const result = await confirmInvite(null, form(''));
    expect(result?.error).toBeTruthy();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('بيتحقق بنوع invite بس، وبعدها يودّي لشاشة كلمة المرور', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    await expect(confirmInvite(null, form('abc123'))).rejects.toThrow(
      'REDIRECT:/set-password'
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'invite',
      token_hash: 'abc123',
    });
  });

  it('رمز منتهي أو مستعمل = رسالة واضحة، مش تحويل', async () => {
    verifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    });
    const result = await confirmInvite(null, form('old'));
    expect(result?.error).toContain('مابقاش صالح');
    expect(redirect).not.toHaveBeenCalled();
  });
});
