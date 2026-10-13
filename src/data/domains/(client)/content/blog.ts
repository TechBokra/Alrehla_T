import { BlogPost } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';
import { decodeSlug } from '@/lib/utils';

/**
 * مقال واحد بالاسم اللي في الرابط.
 *
 * الأسماء عربية، فالمتصفح بيشفّرها في الرابط (%D8%A7…). والصفحة كانت
 * بتقارن النص المشفّر باللي متخزّن في القاعدة (عربي عادي)، فالمقارنة
 * بتفشل والمقال بيطلع «غير موجود» رغم إنه ظاهر في القايمة.
 *
 * بنجرّب الاتنين: بعد فك التشفير، ولو ما لقيناش، بالنص زي ما جه.
 */
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const supabase = createPublicClient();

  const decoded = decodeSlug(slug);
  const candidates = decoded === slug ? [slug] : [decoded, slug];

  for (const candidate of candidates) {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', candidate)
      .lte('published_at', new Date().toISOString())
      .maybeSingle();

    if (data) {
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
    }
  }

  return null;
};
