import { describe, expect, it, vi } from 'vitest';
import { hasRecoverySession } from './recovery-session';
import type { createClient } from '@/lib/supabase/server';
const client = (getClaims: ReturnType<typeof vi.fn>) => ({ auth: { getClaims } }) as unknown as Awaited<ReturnType<typeof createClient>>;
describe('recovery signature verification', () => {
  it('rejects claims when Supabase reports signature verification failure', async () => {
    const now = Math.floor(Date.now() / 1000);
    const getClaims = vi.fn().mockResolvedValue({ data: { claims: {
      sub: 'user', exp: now + 3600, session_id: 'session', amr: [{ method: 'recovery', timestamp: now }],
    } }, error: new Error('invalid signature') });
    expect(await hasRecoverySession(client(getClaims), 'user')).toBe(false);
  });
  it('fails closed on unavailable verification', async () => {
    expect(await hasRecoverySession(client(vi.fn().mockRejectedValue(new Error('unavailable'))), 'user')).toBe(false);
  });
});
