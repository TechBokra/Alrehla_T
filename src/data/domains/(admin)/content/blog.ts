import { BlogPost } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { mapBlogPost } from '@/data/domains/(shared)/content/blog';

export const getBlogPostById = async (id: string): Promise<BlogPost | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapBlogPost(data);
};

/**
 * **كل** المقالات (منشور + مجدول + مسودة) لشاشات الإدارة.
 *
 * بتقرا بجلسة الأدمن لأن سياسة القراءة بتخفي غير المنشور عن الجميع
 * ما عدا الأدمن. لو فشلت القراءة بنرمي — القايمة الفاضية كانت هتتقرأ
 * «مفيش مقالات» وهي بس ماقدرتش تقرا.
 */
export const getAdminBlogPosts = async (): Promise<BlogPost[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapBlogPost);
};
