'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { GOALS_MAX, validateGoalInput } from '@/lib/story-goals';
import { isMissingSchemaError, normalizeAppliesTo } from '@/lib/applies-to';

/**
 * أهداف التخصيص من اللوحة (ملف 12) — نفس قواعد خانات التخصيص.
 *
 * ⚠️ كل المخارج بترجّع `{ ok }` — مفيش `throw` (قاعدة «هـ»: Next بيمسح نصّ
 *    الاستثناء في الإنتاج والإداري بيشوف صفحة خطأ عامة).
 * ⚠️ وكل كتابة بـ`.select()`: الكتابة اللي الصلاحيات ترفضها بترجع صفر صفوف
 *    **من غير خطأ** (قاعدة «ك»)، والشاشة كانت هتقول «اتحفظ».
 */

export type GoalResult = { ok: true } | { ok: false; error: string; field?: 'label' | 'appliesTo' };

const NEEDS_FILE_12 = 'أهداف التخصيص محتاجة ملف 12 يتشغّل الأول';

async function guard(): Promise<{ ok: true; userId: string; name: string } | { ok: false; error: string }> {
  try {
    const user = await requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة أهداف التخصيص');
    return { ok: true, userId: user.id, name: user.fullName ?? '' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }
}

/** رسالة الخطأ للإداري — من غير تفاصيل القاعدة. */
function writeError(error: { code?: string; message?: string }, fallback: string): GoalResult {
  if (isMissingSchemaError(error)) return { ok: false, error: NEEDS_FILE_12 };
  // محفّز ملف 12 بيرفض منتج اتمسح — رسالته عربي ومفهومة.
  if (error.code === 'P0001' && error.message) return { ok: false, error: error.message, field: 'appliesTo' };
  if (error.code === '23514') return { ok: false, error: 'الهدف لازم يبقى من ٢ لـ١٢٠ حرف', field: 'label' };
  return { ok: false, error: fallback };
}

function refresh() {
  revalidatePath('/dashboard/admin/products/story-goals');
  revalidatePath('/enha-lak/custom/[productSlug]', 'page');
  revalidatePath('/enha-lak/custom-library/[productSlug]', 'page');
  revalidatePath('/enha-lak/custom-subscription/[tierId]', 'page');
}

export async function saveStoryGoal(input: {
  id?: string;
  label: string;
  isActive: boolean;
  /** `null` = كل المنتجات والصندوق. */
  appliesTo: string[] | null;
}): Promise<GoalResult> {
  const g = await guard();
  if (!g.ok) return g;

  const checked = validateGoalInput(input);
  if (!checked.ok) return { ...checked, field: 'label' };
  const appliesTo = normalizeAppliesTo(input.appliesTo);

  const supabase = await createClient();
  const row = {
    label: checked.label,
    applies_to: appliesTo,
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase.from('story_goals').update(row).eq('id', input.id).select('id');
    if (error) {
      console.error('تعذّر تعديل هدف التخصيص', error);
      return writeError(error, 'تعذّر حفظ الهدف — جرّب تاني');
    }
    if (!data || data.length === 0) {
      return { ok: false, error: 'الهدف مش موجود — يمكن حد مسحه. حدّث الصفحة.' };
    }
  } else {
    const { data: existing, error: countError } = await supabase.from('story_goals').select('sort_order');
    if (countError) {
      console.error('تعذّر قراءة أهداف التخصيص', countError);
      return writeError(countError, 'تعذّر حفظ الهدف — جرّب تاني');
    }
    if ((existing ?? []).length >= GOALS_MAX) {
      return { ok: false, error: `الحد ${GOALS_MAX} هدف — امسح أو أوقف واحد الأول` };
    }
    // الجديد في آخر القايمة.
    const last = Math.max(0, ...(existing ?? []).map((r) => r.sort_order ?? 0));
    const { data, error } = await supabase
      .from('story_goals')
      .insert({ ...row, sort_order: last + 10 })
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('تعذّر إضافة هدف التخصيص', error);
      return error ? writeError(error, 'تعذّر إضافة الهدف — جرّب تاني') : { ok: false, error: 'تعذّر إضافة الهدف — جرّب تاني' };
    }
  }

  await logAuditAction({
    actorProfileId: g.userId,
    actorName: g.name,
    action: input.id ? 'story_goal_updated' : 'story_goal_created',
    entityType: 'StoryGoal',
    entityId: input.id,
    metadata: { label: checked.label, appliesTo },
  });
  refresh();
  return { ok: true };
}

/** تفعيل/إيقاف من غير ما تفتح الفورم. */
export async function setStoryGoalActive(id: string, isActive: boolean): Promise<GoalResult> {
  const g = await guard();
  if (!g.ok) return g;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_goals')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, label');
  if (error) {
    console.error('تعذّر تغيير حالة هدف التخصيص', error);
    return writeError(error, 'تعذّر التغيير — جرّب تاني');
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'الهدف مش موجود — حدّث الصفحة.' };
  }

  await logAuditAction({
    actorProfileId: g.userId,
    actorName: g.name,
    action: isActive ? 'story_goal_activated' : 'story_goal_suspended',
    entityType: 'StoryGoal',
    entityId: id,
    metadata: { label: data[0].label },
  });
  refresh();
  return { ok: true };
}

/**
 * مسح هدف.
 *
 * الطلبات القديمة مش بتتأثر: كل طلب حافظ نص الهدف نفسه.
 */
export async function deleteStoryGoal(id: string): Promise<GoalResult> {
  const g = await guard();
  if (!g.ok) return g;

  const supabase = await createClient();
  const { data, error } = await supabase.from('story_goals').delete().eq('id', id).select('id, label');
  if (error) {
    console.error('تعذّر مسح هدف التخصيص', error);
    return writeError(error, 'تعذّر مسح الهدف — جرّب تاني');
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'الهدف مش موجود — يمكن اتمسح قبل كده. حدّث الصفحة.' };
  }

  await logAuditAction({
    actorProfileId: g.userId,
    actorName: g.name,
    action: 'story_goal_deleted',
    entityType: 'StoryGoal',
    entityId: id,
    metadata: { label: data[0].label },
  });
  refresh();
  return { ok: true };
}

/** الترتيب الجديد كله — بعد سهم ↑ أو ↓. */
export async function reorderStoryGoals(ids: string[]): Promise<GoalResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > GOALS_MAX * 2) {
    return { ok: false, error: 'ترتيب غير صالح' };
  }

  const supabase = await createClient();
  for (const [i, id] of ids.entries()) {
    const { data, error } = await supabase
      .from('story_goals')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', id)
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('تعذّر حفظ ترتيب الأهداف', error);
      return { ok: false, error: 'الترتيب ما اتحفظش كله — حدّث الصفحة وجرّب تاني' };
    }
  }
  refresh();
  return { ok: true };
}
