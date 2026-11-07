import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isBlogPlanStatus, type BlogPlanStatus } from '@/lib/blog-plan';

export type BlogPlanItem = {
  id: string;
  title: string;
  notes: string;
  plannedFor: string | null;
  status: BlogPlanStatus;
  postId: string | null;
  postTitle: string | null;
  postPublished: boolean;
  createdAt: string;
  doneAt: string | null;
};

export type BlogPlanPostChoice = { id: string; title: string; published: boolean };

/**
 * الخطة كلها + المقالات للربط. `null` = الجدول لسه مش موجود (ملف 20261107110000
 * ماتشغّلش) — الصفحة بتقول كده بدل ما تقع.
 */
export async function getBlogPlan(): Promise<{ items: BlogPlanItem[]; posts: BlogPlanPostChoice[] } | null> {
  const supabase = await createClient();
  const [planRes, postsRes] = await Promise.all([
    supabase
      .from('blog_plan_items')
      .select('id, title, notes, planned_for, status, post_id, created_at, done_at')
      .order('planned_for', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(300),
    supabase.from('blog_posts').select('id, title, is_draft').order('created_at', { ascending: false }).limit(200),
  ]);
  if (planRes.error) {
    console.error('getBlogPlan', planRes.error.message);
    return null;
  }
  const posts: BlogPlanPostChoice[] = (postsRes.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    published: p.is_draft === false,
  }));
  const byId = new Map(posts.map((p) => [p.id, p]));
  const items: BlogPlanItem[] = (planRes.data ?? [])
    .filter((r) => isBlogPlanStatus(r.status))
    .map((r) => {
      const post = r.post_id ? byId.get(r.post_id) : undefined;
      return {
        id: r.id,
        title: r.title,
        notes: r.notes ?? '',
        plannedFor: r.planned_for,
        status: r.status as BlogPlanStatus,
        postId: r.post_id,
        postTitle: post?.title ?? null,
        postPublished: post?.published ?? false,
        createdAt: r.created_at,
        doneAt: r.done_at,
      };
    });
  return { items, posts };
}
