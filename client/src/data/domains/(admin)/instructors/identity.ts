import { createClient } from '@/lib/supabase/server';

/**
 * The instructor record belonging to the signed-in user, if any.
 * Returns null for anyone who is not an instructor.
 */
export async function getMyInstructorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}
