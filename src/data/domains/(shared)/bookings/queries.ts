import { CourseSubscription } from '@/types';
import { createClient } from '@/lib/supabase/server';
import type { QueryReadOptions } from '@/data/query-result';

export async function getCourseSubscriptions(options: QueryReadOptions = {}): Promise<CourseSubscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('course_subscriptions')
    .select('id, package_id, user_id, participant_type, child_id, status, started_at, created_at')
    .order('created_at', { ascending: false });

  if (error && options.throwOnError) throw error;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    packageId: row.package_id,
    userId: row.user_id,
    participantType: row.participant_type as CourseSubscription['participantType'],
    childId: row.child_id ?? undefined,
    status: row.status as CourseSubscription['status'],
    startedAt: row.started_at ?? row.created_at,
    createdAt: row.created_at,
  }));
}
