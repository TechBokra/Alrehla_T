import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { isMissingSchemaError, isVisibleFor, readAppliesTo, type AppliesToTarget } from '@/lib/applies-to';
import { DEFAULT_GOALS, type StoryGoal } from '@/lib/story-goals';

type GoalRow = {
  id: string;
  label: string;
  applies_to: string[] | null;
  is_active: boolean;
  sort_order: number;
};

function mapGoal(r: GoalRow): StoryGoal {
  return {
    id: r.id,
    label: r.label,
    appliesTo: readAppliesTo(r.applies_to),
    isActive: Boolean(r.is_active),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
  };
}

function defaultsFor(target: AppliesToTarget): StoryGoal[] {
  return DEFAULT_GOALS.filter((g) => isVisibleFor(g.appliesTo, target));
}

/**
 * أهداف التخصيص المفعّلة للمنتج ده (أو الصندوق) — لخطوة «تفاصيل القصة».
 *
 * ⚠️ **أي خطأ = الأربعة القدام، مش صفحة خطأ ولا قايمة فاضية.** الكود
 *    ممكن يتنشر قبل ملف 12، والهدف إلزامي في القصة — من غير أهداف العميل
 *    كان هيضطر يكتب «هدف آخر» في كل طلب.
 * ⚠️ والجدول **موجود وفاضي** (الإدارة أوقفت كله) = قايمة فاضية فعلًا:
 *    الشاشة نفسها بترجع للأربعة القدام، و«هدف آخر» فاضل.
 */
export async function getActiveStoryGoals(target: AppliesToTarget): Promise<StoryGoal[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('story_goals')
      .select('id, label, applies_to, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      if (!isMissingSchemaError(error)) console.error('تعذّر قراءة أهداف التخصيص', error);
      return defaultsFor(target);
    }
    return (data ?? []).map(mapGoal).filter((g) => isVisibleFor(g.appliesTo, target));
  } catch (err) {
    console.error('تعذّر قراءة أهداف التخصيص', err);
    return defaultsFor(target);
  }
}

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
