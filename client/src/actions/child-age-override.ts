'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';

/**
 * استثناء السن من الإدارة (قرار ٢٤ أكتوبر، بند ١٠).
 *
 * الطفل بيتعامل كأنه في الفئة دي في الحجز، بغض النظر عن تاريخ ميلاده.
 * ⚠️ ولي الأمر مايقدرش يكتب العمود ده — محفّز في القاعدة بيرفض.
 */
export async function setChildAgeOverride(
  childId: string,
  value: 'under_12' | '12_plus' | ''
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    admin = await requireAdmin('canManageBookings');
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'غير مصرح' };
  }
  if (value !== '' && value !== 'under_12' && value !== '12_plus') {
    return { ok: false, error: 'قيمة غير معروفة.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('child_profiles')
    .update({ age_group_override: value || null } as never)
    .eq('id', childId)
    .select('user_profile_id');

  if (error) {
    if (/age_group_override/.test(error.message)) {
      return {
        ok: false,
        error:
          'الخانة دي محتاجة تحديث قاعدة البيانات (ترحيل ٢٤ أكتوبر) يترفع الأول.',
      };
    }
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'الطفل مش موجود.' };

  await logAuditAction({
    actorProfileId: admin.id,
    action: 'child_age_override_set',
    entityType: 'child_profile',
    entityId: childId,
    metadata: { value: value || null },
  });

  const owner = (data[0] as { user_profile_id?: string }).user_profile_id;
  if (owner) revalidatePath(`/dashboard/admin/users/${owner}`);
  return { ok: true };
}
