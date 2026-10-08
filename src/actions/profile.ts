'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/data/domains/auth';

/**
 * تعديل بيانات الحساب.
 *
 * كانت شاشة «إعدادات الحساب» بتعرض الاسم والإيميل **كنص للقراءة بس** —
 * مفيش أي طريقة المستخدم يصلّح اسمه، ولا حتى بعد ما يتسجّل باسم غلط.
 *
 * الإيميل مش هنا: تغييره بيحتاج تأكيد على الإيميل الجديد قبل ما يسري،
 * وده مسار تاني بالكامل. لو كتبناه هنا كخانة عادية، هيبقى ممكن حد يغيّر
 * إيميل الدخول لحساب من غير ما يثبت إنه بيملكه.
 */
export type ProfileResult = { ok: true } | { ok: false; error: string; field?: 'fullName' };

export async function updateMyProfile(fullName: string): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    return { ok: false, error: 'لازم تسجّل دخول الأول' };
  }

  const name = fullName.trim();
  if (name.length < 2) {
    return { ok: false, error: 'الاسم قصير أوي', field: 'fullName' };
  }
  if (name.length > 80) {
    return { ok: false, error: 'الاسم طويل أوي', field: 'fullName' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ full_name: name, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('id');

  if (error) {
    console.error('Error updating profile', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }

  // صفر صفوف من غير خطأ = صلاحيات القاعدة رفضت التعديل بصمت. من غير
  // الفحص ده الشاشة بتقول «اتحفظ» والاسم زي ما هو.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'التعديل مروّحش للقاعدة — صلاحيات الحساب مش سامحة بالتعديل.',
    };
  }

  revalidatePath('/account/settings');
  revalidatePath('/account');
  revalidatePath('/', 'layout');
  return { ok: true };
}
