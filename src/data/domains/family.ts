import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ChildProfile } from '@/types';
import type { QueryReadOptions } from '@/data/query-result';

/** Only the signed-in guardian's children; use the session client, never admin credentials. */
export async function getFamilyMembers(options: QueryReadOptions = {}): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && options.throwOnError) throw authError;
  if (!user) return [];

  const { data, error } = await supabase.from('child_profiles')
    .select('*')
    .eq('user_profile_id', user.id)
    .order('created_at', { ascending: true });
  if (error && options.throwOnError) throw error;
  if (error || !data) return [];

  return data.map((child) => ({
    id: child.id,
    userProfileId: child.user_profile_id,
    fullName: child.full_name,
    birthDate: child.birth_date,
    gender: (child.gender as ChildProfile['gender']) ?? null,
    avatarUrl: child.avatar_url,
    createdAt: child.created_at,
    accountProfileId: child.account_profile_id ?? null,
  }));
}
