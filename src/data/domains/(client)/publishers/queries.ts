import { Publisher } from '@/types';
import { decodeSlug } from '@/lib/utils';
import { createPublicClient } from '@/lib/supabase/public';

export const getPublisherBySlug = async (rawSlug: string): Promise<Publisher | null> => {
  const slug = decodeSlug(rawSlug);
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('publishers')
    .select('*')
    .eq('slug', slug)
    .single();

  if ((error || !data)) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url || undefined,
    bio: data.bio,
    isSample: data.is_sample ?? false,
    status: data.status
  };
};
