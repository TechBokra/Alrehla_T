import { BlogPost } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';

export const getBlogPosts = async (
  options: { includeDrafts?: boolean } = {}
): Promise<BlogPost[]> => {
  const supabase = createPublicClient();
  // A post dated in the future is a draft: the public listing must not show it.
  const query = supabase.from('blog_posts').select('*');
  if (!options.includeDrafts) {
    query.lte('published_at', new Date().toISOString());
  }
  const { data, error } = await query.order('published_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    coverImageUrl: p.cover_image_url || undefined,
    authorName: p.author_name || 'فريق الرحلة',
    publishedAt: p.published_at
  }));
};
