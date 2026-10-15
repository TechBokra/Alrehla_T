import { createClient } from '@/lib/supabase/server';
import { parseRpcResult } from '@/lib/aqlam/errors';

/** قراءة بصلاحية المستخدم نفسه (RLS): نصوصه، وللولي نصوص أبنائه. */

export type MyPostRow = {
  id: string;
  title: string;
  status: string;
  displayName: string;
  createdAt: string;
  publishedAt: string | null;
  reactionCount: number;
  commentCount: number;
};

const COLUMNS = 'id,title,status,display_name,created_at,published_at,reaction_count,comment_count';

export async function listMyPosts(userId: string): Promise<MyPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(COLUMNS)
    .eq('writer_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Error listing my aqlam posts', error);
    throw new Error('تعذّر تحميل نصوصك');
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    displayName: p.display_name,
    createdAt: p.created_at,
    publishedAt: p.published_at,
    reactionCount: p.reaction_count,
    commentCount: p.comment_count,
  }));
}

export type GuardianPostRow = MyPostRow & { body: string; writerId: string };

/** نصوص الأبناء اللي بتستنى قرار ولي الأمر. RLS بتقصرها على أبنائه. */
export async function listPostsAwaitingGuardian(): Promise<GuardianPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(`${COLUMNS},body,writer_id`)
    .eq('status', 'pending_guardian')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('Error listing posts awaiting guardian', error);
    throw new Error('تعذّر تحميل النصوص');
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    displayName: p.display_name,
    createdAt: p.created_at,
    publishedAt: p.published_at,
    reactionCount: p.reaction_count,
    commentCount: p.comment_count,
    body: p.body,
    writerId: p.writer_id,
  }));
}

/** حالة الحساب الحالي في أقلام الرحلة (من دالة القاعدة `aqlam_my_status`). */
export type MyAqlamStatus = {
  enabled: boolean;
  suspended: boolean;
  isChild: boolean;
  ageGroup: 'under_12' | '12_plus';
  needsBirthdate: boolean;
  publishingLocked: boolean;
  fullName: string;
  isAdmin: boolean;
  isInstructor: boolean;
};

export async function getMyAqlamStatus(): Promise<MyAqlamStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('aqlam_my_status');
  if (error) {
    console.error('aqlam_my_status failed', error);
    return null;
  }
  const out = parseRpcResult(data);
  if (!out.ok) return null;
  const s = out.data;
  return {
    enabled: s.enabled === true,
    suspended: s.suspended === true,
    isChild: s.is_child === true,
    ageGroup: s.age_group === '12_plus' ? '12_plus' : 'under_12',
    needsBirthdate: s.needs_birthdate === true,
    publishingLocked: s.publishing_locked === true,
    fullName: typeof s.full_name === 'string' ? s.full_name : '',
    isAdmin: s.is_admin === true,
    isInstructor: s.is_instructor === true,
  };
}
