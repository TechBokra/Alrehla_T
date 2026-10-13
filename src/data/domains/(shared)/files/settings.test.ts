import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { readPrivateFileRetentionDays } from '@/data/domains/(shared)/files/settings';

function client(value: unknown, error: unknown = null) {
  const q = { select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: value == null ? null : { value }, error }) };
  return { from: () => q } as unknown as SupabaseClient<Database>;
}
describe('strict private-file retention configuration', () => {
  it('reads configured retention and preserves the default for an absent field', async () => {
    expect(await readPrivateFileRetentionDays(client({ fileRetentionDays: 120 }))).toBe(120);
    expect(await readPrivateFileRetentionDays(client({}))).toBe(30);
  });
  it('rejects failed, missing and malformed configuration', async () => {
    await expect(readPrivateFileRetentionDays(client(null, { message: 'unavailable' }))).rejects.toThrow();
    await expect(readPrivateFileRetentionDays(client(null))).rejects.toThrow();
    await expect(readPrivateFileRetentionDays(client({ fileRetentionDays: 'oops' }))).rejects.toThrow();
  });
});
