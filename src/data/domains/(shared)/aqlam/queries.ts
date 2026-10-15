import { createPublicClient } from '@/lib/supabase/public';
import { isAgeBandId, type AgeBandId } from '@/lib/age-bands';
import { isAqlamCategory, type AqlamCategory } from '@/lib/aqlam/post';
import {
  AQLAM_PAGE_SIZE,
  type AqlamPost,
  type AqlamPostCard,
  type AqlamPublicComment,
  type AqlamSort,
} from './types';

/**
 * قراءة «أقلام الرحلة» العامة.
 *
 * ⚠️ **عميل بلا كوكيز** (`createPublicClient`) — نفس سبب بقية الصفحات
 *    العامة: قراءة الكوكيز بتخلّي الصفحة بلا تخزين مؤقت.
 * ⚠️ **من الـview العامة بس** (`aqlam_public_posts` / `_comments`): مفيش
 *    `writer_id` ولا بيانات حساب، ومقفولة لما التشغيل مقفول.
 * ⚠️ لو الاستعلام فشل بنرمي — الصفحة تقول إنها فشلت، مش بنعرض قايمة فاضية
 *    كأن مفيش نصوص (قاعدة ٢.٧).
 */

const CARD_COLUMNS =
  'id,title,excerpt,category,display_name,age_band,published_at,reaction_count,comment_count,featured_at';

type CardRow = {
  id: string | null;
  title: string | null;
  excerpt: string | null;
  category: string | null;
  display_name: string | null;
  age_band: string | null;
  published_at: string | null;
  reaction_count: number | null;
  comment_count: number | null;
  featured_at: string | null;
};

function toCard(row: CardRow): AqlamPostCard | null {
  // الـview بترجّع الأعمدة nullable بحكم النوع؛ صف ناقص مايتعرضش.
  if (!row.id || !row.title || !row.display_name) return null;
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? '',
    category: row.category ?? '',
    displayName: row.display_name,
    ageBand: isAgeBandId(row.age_band) ? row.age_band : null,
    publishedAt: row.published_at,
    reactionCount: row.reaction_count ?? 0,
    commentCount: row.comment_count ?? 0,
    featured: !!row.featured_at,
  };
}

export async function listPublicPosts(opts: {
  category?: AqlamCategory | null;
  band?: AgeBandId | null;
  sort?: AqlamSort;
  page?: number;
}): Promise<{ posts: AqlamPostCard[]; hasMore: boolean }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const from = (page - 1) * AQLAM_PAGE_SIZE;
  const supabase = createPublicClient();

  let query = supabase.from('aqlam_public_posts').select(CARD_COLUMNS);
  if (opts.category && isAqlamCategory(opts.category)) query = query.eq('category', opts.category);
  if (opts.band && isAgeBandId(opts.band)) query = query.eq('age_band', opts.band);
  query =
    opts.sort === 'top'
      ? query.order('reaction_count', { ascending: false }).order('published_at', { ascending: false })
      : query.order('published_at', { ascending: false });

  // استعلام واحد، وصف زيادة نعرف منه فيه صفحة بعدها (من غير count منفصل).
  const { data, error } = await query.range(from, from + AQLAM_PAGE_SIZE);
  if (error) {
    console.error('Error listing aqlam posts', error);
    throw new Error('تعذّر تحميل النصوص');
  }
  const cards = (data ?? []).map(toCard).filter((c): c is AqlamPostCard => c !== null);
  return { posts: cards.slice(0, AQLAM_PAGE_SIZE), hasMore: (data ?? []).length > AQLAM_PAGE_SIZE };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** النص بالكامل، أو null لو مش موجود/مش منشور. */
export async function getPublicPost(id: string): Promise<AqlamPost | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('aqlam_public_posts')
    .select(`${CARD_COLUMNS},body,age_group,allow_indexing,comments_enabled,share_card_url`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('Error reading aqlam post', error);
    throw new Error('تعذّر تحميل النص');
  }
  if (!data) return null;
  const card = toCard(data);
  if (!card || !data.body) return null;
  return {
    ...card,
    body: data.body,
    ageGroup: data.age_group === '12_plus' ? '12_plus' : 'under_12',
    allowIndexing: data.allow_indexing === true,
    commentsEnabled: data.comments_enabled !== false,
    shareCardUrl: data.share_card_url ?? null,
  };
}

export async function listPublicComments(postId: string): Promise<AqlamPublicComment[]> {
  if (!UUID_RE.test(postId)) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('aqlam_public_comments')
    .select('id,author_display_name,is_instructor,body,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.error('Error reading aqlam comments', error);
    throw new Error('تعذّر تحميل التعليقات');
  }
  return (data ?? []).flatMap((c) =>
    c.id && c.body && c.author_display_name && c.created_at
      ? [
          {
            id: c.id,
            authorDisplayName: c.author_display_name,
            isInstructor: c.is_instructor === true,
            body: c.body,
            createdAt: c.created_at,
          },
        ]
      : [],
  );
}

/** نصوص مسموح لها بجوجل (١٢+ وإذن الكاتب) — للـsitemap. */
export async function listIndexablePostIds(): Promise<{ id: string; publishedAt: string | null }[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('aqlam_public_posts')
    .select('id,published_at')
    .eq('allow_indexing', true)
    .eq('age_group', '12_plus')
    .order('published_at', { ascending: false })
    .limit(5000);
  if (error) {
    console.error('Error listing indexable aqlam posts', error);
    return [];
  }
  return (data ?? []).flatMap((r) => (r.id ? [{ id: r.id, publishedAt: r.published_at }] : []));
}
