import { StudyMaterial } from '@/types';
import { createClient } from '@/lib/supabase/server';

/**
 * المواد الدراسية.
 *
 * كانت تلات مواد مخترعة مربوطة بأسماء باقات مخترعة — وكل طالب في المنصة
 * بيشوف نفس التلاتة.
 */
export const getStudyMaterials = async (): Promise<StudyMaterial[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('study_materials')
    .select('id, title, description, package_id')
    .order('title', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const packageIds = [...new Set(data.map((m) => m.package_id).filter(Boolean))] as string[];
  const { data: packages } = packageIds.length
    ? await supabase
        .from('creative_writing_packages')
        .select('id, name')
        .in('id', packageIds)
    : { data: [] as { id: string; name: string }[] };

  const packageName = new Map((packages ?? []).map((p) => [p.id, p.name]));

  return data.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? '',
    packageName: m.package_id ? (packageName.get(m.package_id) ?? '—') : '—',
  }));
};
