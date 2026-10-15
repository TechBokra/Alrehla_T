import { createClient } from '@/lib/supabase/server';

/**
 * قراءات شاشة الإدارة — بصلاحية المسؤول نفسه (سياسات RLS للإدارة).
 * مفيش أي استعلام هنا بيتنفّذ في صفحات الزوار.
 */

export type AdminPostRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  displayName: string;
  writerId: string;
  ageGroup: string;
  createdAt: string;
  featured: boolean;
};

const POST_COLUMNS = 'id,title,body,status,display_name,writer_id,age_group,created_at,featured_at';

export async function listAdminPosts(statuses: string[], limit = 50): Promise<AdminPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('aqlam_posts')
    .select(POST_COLUMNS)
    .in('status', statuses)
    .order('created_at', { ascending: statuses.includes('pending_review') })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam posts for admin', error);
    throw new Error('تعذّر تحميل النصوص');
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    status: p.status,
    displayName: p.display_name,
    writerId: p.writer_id,
    ageGroup: p.age_group,
    createdAt: p.created_at,
    featured: !!p.featured_at,
  }));
}

export type AdminReportRow = {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  /** عنوان النص أو نص التعليق (للمعاينة). */
  preview: string;
  postId: string | null;
  targetStatus: string | null;
};

export async function listOpenReports(limit = 50): Promise<AdminReportRow[]> {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from('aqlam_reports')
    .select('id,target_type,target_id,reason,details,created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error listing aqlam reports', error);
    throw new Error('تعذّر تحميل البلاغات');
  }
  const rows = reports ?? [];
  const postIds = rows.filter((r) => r.target_type === 'post').map((r) => r.target_id);
  const commentIds = rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id);

  const [posts, comments] = await Promise.all([
    postIds.length
      ? supabase.from('aqlam_posts').select('id,title,status').in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase.from('aqlam_comments').select('id,body,post_id,status').in('id', commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const postMap = new Map((posts.data ?? []).map((p) => [p.id, p]));
  const commentMap = new Map((comments.data ?? []).map((c) => [c.id, c]));

  return rows.map((r) => {
    const isPost = r.target_type === 'post';
    const post = isPost ? postMap.get(r.target_id) : undefined;
    const comment = isPost ? undefined : commentMap.get(r.target_id);
    return {
      id: r.id,
      targetType: isPost ? 'post' : 'comment',
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
      preview: isPost ? (post?.title ?? '(محذوف)') : (comment?.body ?? '(محذوف)'),
      postId: isPost ? r.target_id : (comment?.post_id ?? null),
      targetStatus: isPost ? (post?.status ?? null) : (comment?.status ?? null),
    };
  });
}
