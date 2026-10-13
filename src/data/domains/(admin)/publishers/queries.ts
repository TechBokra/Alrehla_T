import { Publisher } from '@/types';
import { createClient } from '@/lib/supabase/server';

/** The publisher record belonging to the signed-in user, if any. */
export async function getMyPublisher(): Promise<Publisher | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data } = await supabase
    .from('publishers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // ⚠️ حساب دوره ناشر ومالوش صف دار نشر — بيتعمل دلوقتي بدل ما لوحته
  //    كلها تطلع «غير موجود» (`@/lib/ensure-publisher`).
  if (!data) {
    const { ensurePublisherRowForPublisher } = await import('@/lib/ensure-publisher');
    const created = await ensurePublisherRowForPublisher(user.id);
    if (!created) return null;
    ({ data } = await supabase.from('publishers').select('*').eq('id', created.id).maybeSingle());
    if (!data) return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url || undefined,
    bio: data.bio,
    isSample: data.is_sample ?? false,
    status: data.status,
  };
}
