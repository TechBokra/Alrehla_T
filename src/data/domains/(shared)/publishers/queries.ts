import { Publisher } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';

export const getPublishers = async (): Promise<Publisher[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('publishers')
    .select('*')
    .order('created_at', { ascending: false });

  if ((error || !data || data.length === 0)) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    logoUrl: p.logo_url || undefined,
    bio: p.bio,
    isSample: p.is_sample,
    status: p.status
  }));
};
