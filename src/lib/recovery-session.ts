import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { hasValidRecoveryClaims } from './recovery-claims';

export async function hasRecoverySession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    return !error && hasValidRecoveryClaims(data?.claims, userId);
  } catch {
    return false;
  }
}
