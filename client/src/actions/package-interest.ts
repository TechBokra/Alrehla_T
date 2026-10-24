'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';

/**
 * «بلّغني لما تفتح» — باقات «قريبًا» (قرار ٢٤ أكتوبر، بند ٩).
 *
 * ⚠️ كل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 * ⚠️ لو جدول `package_interest` لسه مش موجود (الترحيل ما اتشغّلش)،
 *    بنرجّع رسالة واضحة بدل خطأ القاعدة الخام.
 */

export type InterestResult =
  { ok: true; already?: boolean } | { ok: false; error: string };

const NOT_READY =
  'الخاصية دي لسه بتتجهّز. جرّب كمان شوية، أو تابعنا على صفحاتنا.';

function isMissingTable(message: string | undefined): boolean {
  return Boolean(
    message &&
    /package_interest/.test(message) &&
    /does not exist|schema cache/.test(message)
  );
}

export async function registerPackageInterest(
  packageId: string
): Promise<InterestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'سجّل دخولك الأول عشان نقدر نبلّغك.' };

  const id = String(packageId ?? '').trim();
  if (!id) return { ok: false, error: 'الباقة مش معروفة.' };

  const { error } = await supabase
    .from('package_interest' as never)
    .insert({ package_id: id, user_id: user.id } as never);

  if (error) {
    // صف موجود = سجّل قبل كده — ده نجاح من ناحية المستخدم.
    if (error.code === '23505') return { ok: true, already: true };
    if (isMissingTable(error.message)) return { ok: false, error: NOT_READY };
    console.error('registerPackageInterest', error);
    return { ok: false, error: 'تعذّر التسجيل. جرّب تاني.' };
  }
  return { ok: true };
}

/** عدد المهتمين — للإدارة في شاشة الباقة. */
export async function countPackageInterest(
  packageId: string
): Promise<number | null> {
  try {
    await requireAdmin('canManageCatalog');
  } catch {
    return null;
  }
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('package_interest' as never)
    .select('id', { count: 'exact', head: true })
    .eq('package_id', packageId)
    .is('notified_at', null);
  if (error) return null;
  return count ?? 0;
}

/**
 * الإدارة فتحت الباقة → إشعار لكل اللي طلبوا يتبلّغوا ولسه ما اتبلّغوش.
 *
 * ⚠️ `notified_at` بيتكتب بعد الإشعار، فالضغطة التانية ماتبعتش تاني.
 */
export async function notifyPackageInterest(
  packageId: string
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  let admin;
  try {
    admin = await requireAdmin('canManageCatalog');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from('creative_writing_packages')
    .select('name, slug')
    .eq('id', packageId)
    .maybeSingle();
  if (!pkg) return { ok: false, error: 'الباقة مش موجودة.' };

  const { data: rows, error } = await supabase
    .from('package_interest' as never)
    .select('id, user_id')
    .eq('package_id', packageId)
    .is('notified_at', null);
  if (error) {
    return {
      ok: false,
      error: isMissingTable(error.message)
        ? NOT_READY
        : 'تعذّر قراءة المهتمين.',
    };
  }

  const list = (rows ?? []) as unknown as { id: string; user_id: string }[];
  let sent = 0;
  for (const row of list) {
    const res = await notifyUser({
      recipientProfileId: row.user_id,
      title: `باقة «${pkg.name}» فتحت للحجز`,
      message: 'طلبت نبلّغك لما تفتح — تقدر تحجز دلوقتي.',
      link: `/creative-writing/packages/${pkg.slug}`,
    });
    if (!res.sent) continue;
    await supabase
      .from('package_interest' as never)
      .update({ notified_at: new Date().toISOString() } as never)
      .eq('id', row.id);
    sent += 1;
  }

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'package_interest_notified',
    entityType: 'creative_writing_package',
    entityId: packageId,
    metadata: { sent },
  });

  revalidatePath(`/dashboard/admin/writing/packages/${packageId}`);
  return { ok: true, sent };
}
