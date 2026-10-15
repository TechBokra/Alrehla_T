'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireAnyAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';
import { isWorkLine, isWorkStage } from '@/lib/work-tasks';
import type { AdminPermission } from '@/types';

/**
 * توزيع الطلبات على المسؤولين (ملف 14).
 *
 * المهام نفسها **بتتعمل وتتقفل لوحدها في القاعدة** مع حالة الطلب. هنا:
 * الإعدادات (مين مسؤول عن إيه)، و«تم» بالإيد، وتغيير المسؤول.
 *
 * كل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 */

/**
 * `warning` = العملية نجحت وفيه حاجة جنبها وقعت (الإشعار مثلًا) — نجاح
 * بتحذير، مش فشل: الشاشة بتحدّث نفسها **و**بتعرض السطر.
 */
export type WorkTaskResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; field?: string };

const ALL: AdminPermission[] = [
  'canManageUsers', 'canManageInstructors', 'canManagePublishers', 'canManageCatalog',
  'canManageSubscriptions', 'canManageOrders', 'canManageBookings', 'canManageSupport',
  'canManageContent', 'canManageFinance', 'canViewAuditLogs',
];

async function anyAdmin() {
  try {
    return await requireAnyAdmin(ALL, 'المهام للإدارة بس');
  } catch {
    return null;
  }
}

/** الإداريين فعلًا — عشان مايتسندش لحد مش إداري (القاعدة بتتجاهله برضه). */
async function onlyAdmins(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x)));
  if (unique.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .in('id', unique)
    .in('role', ['super_admin', 'general_supervisor']);
  return (data ?? []).map((r) => r.id);
}

/** مين مسؤول عن نوع ومرحلة — بيستبدل القايمة كلها. */
export async function saveAssignmentRule(
  line: string,
  stage: string,
  profileIds: string[],
): Promise<WorkTaskResult> {
  let admin;
  try {
    admin = await requireAdmin('canManageUsers', 'توزيع الطلبات محتاج صلاحية «المستخدمين»');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }
  if (!isWorkLine(line) || !isWorkStage(stage)) return { ok: false, error: 'نوع أو مرحلة غير معروفة' };

  const ids = await onlyAdmins(profileIds);
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('assignment_rules')
    .delete()
    .eq('line', line)
    .eq('stage', stage);
  if (delError) {
    if (delError.code === '42P01') return { ok: false, error: 'التوزيع محتاج ملف القاعدة 14 يتشغّل الأول' };
    console.error('saveAssignmentRule delete', delError);
    return { ok: false, error: 'تعذّر حفظ التوزيع' };
  }
  if (ids.length) {
    const { error } = await supabase
      .from('assignment_rules')
      .insert(ids.map((profile_id) => ({ line, stage, profile_id })));
    if (error) {
      console.error('saveAssignmentRule insert', error);
      return { ok: false, error: 'تعذّر حفظ التوزيع — القايمة اتفضّت، جرّب تاني' };
    }
  }

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'assignment_rule_saved',
    entityType: 'assignment_rule',
    entityId: `${line}:${stage}`,
    metadata: { profileIds: ids },
  });
  revalidatePath('/dashboard/admin/tasks/assignments');
  return { ok: true };
}

/** «تم» بالإيد — لما المهمة خلصت من غير ما حالة الطلب تتغيّر (الصندوق مثلًا). */
export async function completeWorkTask(id: string): Promise<WorkTaskResult> {
  const admin = await anyAdmin();
  if (!admin) return { ok: false, error: 'المهام للإدارة بس' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .update({ status: 'done', done_at: new Date().toISOString(), done_by: admin.id })
    .eq('id', id)
    .eq('status', 'open')
    .select('id');
  if (error) {
    console.error('completeWorkTask', error);
    return { ok: false, error: 'تعذّر قفل المهمة' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'المهمة اتقفلت قبل كده — حدّث الصفحة' };
  revalidatePath('/dashboard/admin/tasks');
  return { ok: true };
}

/** تغيير المسؤول عن مهمة — والجديد بيوصله إشعار. */
export async function reassignWorkTask(id: string, profileIds: string[]): Promise<WorkTaskResult> {
  const admin = await anyAdmin();
  if (!admin) return { ok: false, error: 'المهام للإدارة بس' };
  const ids = await onlyAdmins(profileIds);
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('work_tasks')
    .select('assignee_ids, title, link, reference')
    .eq('id', id)
    .maybeSingle();
  if (!before) return { ok: false, error: 'المهمة مش موجودة' };

  const { data, error } = await supabase
    .from('work_tasks')
    .update({ assignee_ids: ids })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    console.error('reassignWorkTask', error);
    return { ok: false, error: 'تعذّر تغيير المسؤول' };
  }

  // إشعار للي اتضاف بس (مش للي كان مسؤول أصلًا).
  const added = ids.filter((x) => !(before.assignee_ids ?? []).includes(x) && x !== admin.id);
  let failedNotices = 0;
  for (const who of added) {
    // ⚠️ `notifyUser` (عن طريق `notify_user` في القاعدة) — الإداري ماعندوش
    //    صلاحية كتابة مباشرة في جدول الإشعارات.
    const notice = await notifyUser({
      recipientProfileId: who,
      title: before.title,
      message: `${admin.fullName || 'الإدارة'} سند ليك المهمة دي${before.reference ? ` — ${before.reference}` : ''}. تلاقيها في «مهامي».`,
      link: before.link,
    });
    if (notice.reason === 'failed') failedNotices += 1;
  }

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'work_task_reassigned',
    entityType: 'work_task',
    entityId: id,
    metadata: { profileIds: ids },
  });
  revalidatePath('/dashboard/admin/tasks');

  // ⚠️ **التسنيد اتحفظ، والإشعار هو اللي وقع.** الشاشة بتقول للإداري
  //    «المسؤول الجديد بيوصله إشعار» — فلازم يعرف لما ده مايحصلش،
  //    عشان يبلّغه بنفسه، بدل ما يستنى حد شايف حاجة ماوصلتهوش.
  if (failedNotices > 0) {
    return {
      ok: true,
      warning: 'المهمة اتسندت، بس الإشعار ماوصلش — بلّغ المسؤول بنفسك.',
    };
  }
  return { ok: true };
}
