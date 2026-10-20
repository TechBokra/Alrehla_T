import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { ageAtTime } from '@/lib/time-values';
import { guardianControls } from '@/lib/private-files';

/**
 * المستخدم ده يقدر **يمسح** محتوى صاحب الحساب ده في مساحة الكتابة؟
 *
 *   • صاحبه نفسه: أيوه.
 *   • ولي أمره: لو الطفل أصغر من ١٢ (أو سنّه مش متسجّل) — قرار تامر.
 *
 * ⚠️ قايمة الأبناء بتتقري بجلسة المستخدم، فـRLS بيرجّع أبناءه هو بس.
 */
export async function canManageWriterContent(userId: string, writerId: string): Promise<boolean> {
  if (userId === writerId) return true;
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('birth_date')
    .eq('user_profile_id', userId)
    .eq('account_profile_id', writerId)
    .maybeSingle();
  if (!child) return false;
  return guardianControls(ageAtTime(child.birth_date, Date.now()));
}
