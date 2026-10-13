import { BlogPost } from '@/types';
import { createClient } from '@/lib/supabase/server';

export const getBlogPostById = async (id: string): Promise<BlogPost | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    coverImageUrl: data.cover_image_url || undefined,
    authorName: data.author_name || 'فريق الرحلة',
    publishedAt: data.published_at,
  };
};
