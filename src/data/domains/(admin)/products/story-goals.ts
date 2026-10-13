import type { StoryGoal } from '@/lib/story-goals';
import { createClient } from '@/lib/supabase/server';
import { isMissingSchemaError } from '@/lib/applies-to';
import { mapGoal } from '@/data/domains/(shared)/products/story-goals-internal';

/**
 * كل الأهداف (المفعّل والموقوف) — للوحة، بجلسة الإداري.
 *
 * `needsFile12` = الجدول مش موجود لسه — الشاشة بتقول «محتاجة ملف 12».
 * ⚠️ أي خطأ تاني **بيترمي**: فاضي في اللوحة بيتقري «مفيش أهداف».
 */
export async function getAllStoryGoals(): Promise<{ goals: StoryGoal[]; needsFile12: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_goals')
    .select('id, label, applies_to, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingSchemaError(error)) return { goals: [], needsFile12: true };
    console.error('تعذّر قراءة أهداف التخصيص للوحة', error);
    throw new Error('تعذّر تحميل أهداف التخصيص — جرّب تاني.');
  }
  return { goals: (data ?? []).map(mapGoal), needsFile12: false };
}
