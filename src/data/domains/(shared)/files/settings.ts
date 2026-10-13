import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { normalizeRetentionDays } from '@/lib/private-files';

/** Destructive cleanup must never substitute default settings for a failed read. */
export async function readPrivateFileRetentionDays(client: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await client.from('site_settings')
    .select('value').eq('key', 'general').maybeSingle();
  if (error || !data || !data.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
    throw new Error('Could not read private-file retention settings');
  }
  const days = data.value.fileRetentionDays;
  if (days != null && (typeof days !== 'number' || !Number.isFinite(days))) {
    throw new Error('Private-file retention settings are invalid');
  }
  return normalizeRetentionDays(days);
}
