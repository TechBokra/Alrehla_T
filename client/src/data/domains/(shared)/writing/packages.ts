import type { QueryReadOptions } from '@/data/query-result';
import { WritingPackage } from '@/types';
import { createPublicClient } from '@/lib/supabase/public';

// Import from auth if needed

export const getWritingPackages = async (
  options: QueryReadOptions = {}
): Promise<WritingPackage[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('creative_writing_packages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error && options.throwOnError) throw error;

  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    ageGroup: p.age_group,
    track: (p.track as import('@/types').PackageTrack | null) ?? null,
    price: p.price,
    durationText: p.duration_text,
    sessionsCount: p.sessions_count,
    sessionDuration: p.session_duration || undefined,
    targetAudience: p.target_audience,
    prerequisiteNote: p.prerequisite_note || undefined,
    prerequisitePackageId: p.prerequisite_package_id || undefined,
    shortDescription: p.short_description,
    fullDescription: p.full_description,
    isActive: p.is_active,
    // العمود ممكن يكون لسه مش موجود (قبل ترحيل ٢٤ أكتوبر) = مفتوحة.
    bookingOpen: p.booking_open !== false,
    imageUrl: p.image_url || null,
  }));
};
