import { createClient } from '@/lib/supabase/server';

export async function getProfileUpdateRequestsByInstructor(
  instructorId: string
): Promise<import('@/types').ProfileUpdateRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profile_update_requests')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    instructorId: row.instructor_id,
    requestedChanges: (row.requested_changes ?? {}) as import('@/types').ProfileUpdateRequest['requestedChanges'],
    status: row.status as import('@/types').ProfileUpdateRequest['status'],
    adminFeedback: row.admin_feedback ?? undefined,
    createdAt: row.created_at,
  }));
}
