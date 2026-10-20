import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { normalizeRetentionDays } from '@/lib/private-files';
import { normalizeChildPhotoDays } from '@/lib/child-photos';

/** Destructive cleanup must never substitute default settings for a failed read. */
export async function readPrivateFileRetentionDays(client: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await client.from('site_settings')
    .select('value').eq('key', 'general').maybeSingle();
  if (error || !data || !data.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
    throw new Error('Could not read private-file retention settings');
  }
  const days = data.value.fileRetentionDays;
  if (days != null && (typeof days !== 'number' || !Number.isFinite(days))) {
    throw new Error('Private-file retention settings are invalid');
  }
  return normalizeRetentionDays(days);
}

/**
 * مدة حفظ صور الأطفال في الطلبات المخصصة.
 *
 * ⚠️ **نفس قاعدة الدالة اللي فوق: الفشل بيرمي، مابيرجّعش
 *    الافتراضي.** لو قراءة الإعداد فشلت ورجّعنا «٧ أيام»، المهمة
 *    هتمسح صور الأطفال بمدة إحنا مش متأكدين إنها اللي الإدارة
 *    ظبطتها — وصورة ممسوحة مفيش رجوع فيها.
 */
export async function readChildPhotoRetentionDays(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { data, error } = await client
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle();
  if (error || !data || !data.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
    throw new Error('Could not read child-photo retention settings');
  }
  const days = (data.value as Record<string, unknown>).childPhotoRetentionDays;
  if (days != null && (typeof days !== 'number' || !Number.isFinite(days))) {
    throw new Error('Child-photo retention settings are invalid');
  }
  return normalizeChildPhotoDays(days);
}
