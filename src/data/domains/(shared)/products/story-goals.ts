import { type AppliesToTarget, isVisibleFor, isMissingSchemaError } from '@/lib/applies-to';
import { type StoryGoal, DEFAULT_GOALS } from '@/lib/story-goals';
import { createPublicClient } from '@/lib/supabase/public';
import { mapGoal } from '@/data/domains/(shared)/products/story-goals-internal';

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
