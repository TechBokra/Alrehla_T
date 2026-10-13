import { Testimonial } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';

export const getTestimonials = async (): Promise<Testimonial[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('testimonials')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    authorName: t.author_name,
    authorRole: t.author_role,
    content: t.content
  }));
};
