import { BlogPost } from '@/types';
import type { Database } from '@/types/supabase';
import { createPublicClient } from '@/lib/supabase/public';

export type BlogRow = Database['public']['Tables']['blog_posts']['Row'];

export function mapBlogPost(row: BlogRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    seoDescription: row.seo_description ?? undefined,
    content: row.content,
    coverImageUrl: row.cover_image_url || undefined,
    authorName: row.author_name || 'فريق الرحلة',
    publishedAt: row.published_at,
    isDraft: row.is_draft,
  };
}

/**
 * المقالات **الظاهرة للزوار** فقط: مش مسودة وموعد نشرها جه.
 *
 * ⚠️ نفس الشرط مفروض في القاعدة (سياسة قراءة `blog_posts`)، فحتى لو حد
 *    نادى الـAPI مباشرةً ما يشوفش مسودة ولا مقال مجدول. شاشات الإدارة
 *    اللي بتعرض الكل بتقرا بجلسة الأدمن من `getAdminBlogPosts`.
 */
export const getBlogPosts = async (): Promise<BlogPost[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_draft', false)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (error || !data || data.length === 0) return [];
  return data.map(mapBlogPost);
};
