'use server';
import { createClient } from '@/lib/supabase/server';
import { ChildProfile } from '@/types';
import { revalidatePath } from 'next/cache';
import { requireNotDependent } from '@/lib/auth-guard';

/**
 * ⚠️ **ليه `requireNotDependent` في كل دالة بتكتب هنا؟**
 *
 * نموذج الحسابات بيقول: العميل يضيف أطفالًا فيتفعّل المركز العائلي
 * ويبقى **ولي أمر**، وولي الأمر يقدر يفتح حساب دخول لأي طفل تابع.
 * والطالب التابع **مش** بيعمل طلبات ولا بيبقى ولي أمر.
 *
 * والدوال دي كانت بتتأكد إن في مستخدم داخل **وبس** — بلا أي فحص
 * للدور. يعني حساب طفل تابع كان يقدر ينادي `createFamilyMember`
 * مباشرةً، يعمل «أطفالًا» تحته، ويتحوّل لولي أمر — وبعدها يفتح لهم
 * حسابات دخول من `student-accounts.ts`. سلسلة كاملة خارج النموذج.
 *
 * ⚠️ والصلاحيات مش بتمنع ده: سياسة الإدراج على `child_profiles`
 *    شرطها إن الصف يخص الداخل، والطفل بيكتب صفًا يخصه فعلًا —
 *    فالسياسة **بتسمح عن حق**. المنع ده قرار منتج، ومكانه الخادم.
 *
 * ⚠️ وإخفاء الشاشة مش حماية: `middleware` بيحوّل الطالب بره
 *    `/account`، لكن أكشن الخادم بيتنادى مباشرةً من غير ما يعدّي
 *    على الصفحة أصلًا.
 *
 * `fetchFamilyMembers` مستثناة: قراءة، وبترجّع أبناء الداخل — والطالب
 * مالوش أبناء فبترجّع فاضية.
 */

export async function fetchFamilyMembers(): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from('child_profiles')
    .select('*')
    .eq('user_profile_id', user.id)
    .order('created_at', { ascending: true });
      
  if (error || !data) return [];
    
  return data.map((child: any) => ({
    id: child.id,
    userProfileId: child.user_profile_id,
    fullName: child.full_name,
    birthDate: child.birth_date,
    gender: (child.gender as 'male' | 'female' | null) ?? null,
    avatarUrl: child.avatar_url,
    createdAt: child.created_at,
    accountProfileId: child.account_profile_id ?? null
  }));
}

/**
 * ⚠️ **صورة الطفل كانت بتتقرا ومحدّش بيكتبها.**
 *
 * `child_profiles.avatar_url` موجود في القاعدة، و`fetchFamilyMembers`
 * بترجّعه، و`ChildProfile` فيه `avatarUrl` — **ومفيش ولا موضع في
 * الموقع كله بيحطّ فيه قيمة**. يعني العمود موجود من بدري وفاضي دايمًا.
 *
 * فمعالج الشراء كان بيرسم دايرة رمادية فيها أول حرف من الاسم، وده
 * مكانش عطل عرض — **مكانش فيه صورة أصلًا تتعرض**.
 *
 * دلوقتي ولي الأمر بيحطّها من المركز العائلي، والمعالج بيعرضها.
 */
export async function createFamilyMember(
  fullName: string,
  birthDate: string,
  gender?: 'male' | 'female' | null,
  avatarUrl?: string | null,
): Promise<ChildProfile | null> {
  const user = await requireNotDependent('إضافة فرد للعائلة');
  const supabase = await createClient();

  const { data, error } = await supabase.from('child_profiles')
    .insert({
      user_profile_id: user.id,
      full_name: fullName,
      birth_date: birthDate,
      gender: gender ?? null,
      avatar_url: avatarUrl?.trim() || null
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error creating child profile', error);
    throw new Error('Failed to create child profile');
  }

  revalidatePath('/account/family');

  return {
    id: data.id,
    userProfileId: data.user_profile_id,
    fullName: data.full_name,
    birthDate: data.birth_date,
    gender: (data.gender as 'male' | 'female' | null) ?? null,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at
  };
}

export async function updateFamilyMember(
  id: string,
  fullName: string,
  birthDate: string,
  gender?: 'male' | 'female' | null,
  avatarUrl?: string | null,
): Promise<boolean> {
  const user = await requireNotDependent('تعديل بيانات فرد العائلة');
  const supabase = await createClient();

  const { data, error } = await supabase.from('child_profiles')
    .update({
      full_name: fullName,
      birth_date: birthDate,
      gender: gender ?? null,
      avatar_url: avatarUrl?.trim() || null,
    })
    .eq('id', id)
    .eq('user_profile_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error updating child profile', error);
    return false;
  }

  // ⚠️ قاعدة (و): `UPDATE` على صف مش موجود بينجح بصفر صفوف وبلا خطأ.
  //    من غير الفحص ده الشاشة بتقول «اتحفظ» ومفيش حاجة وصلت.
  if (!data) {
    console.error('Child profile update matched zero rows', id);
    return false;
  }

  revalidatePath('/account/family');
  return true;
}

export async function deleteFamilyMember(id: string): Promise<boolean> {
  const user = await requireNotDependent('حذف فرد من العائلة');
  const supabase = await createClient();

  const { error } = await supabase.from('child_profiles')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', user.id);

  if (error) {
    console.error('Error deleting child profile', error);
    return false;
  }

  revalidatePath('/account/family');
  return true;
}

/**
 * تحديد المشارك في معالجات الطلب — اختيار من العائلة أو إضافة جديد.
 *
 * ثلاث مشاكل كانت هنا، كل واحدة في معالج:
 *   • معالج المكتبة كان بيجمع بيانات الطفل و**ما بيحفظهاش خالص**، ولو
 *     الاسم فاضي بيكتب في الطلب نص ثابت «مشارك من العائلة» — حتى لو
 *     العميل اختار طفل موجود. يعني الكتاب ممكن يتطبع باسم غلط.
 *   • معالج التخصيص كان بيعمل **ملف طفل جديد مع كل طلب** لو الاسم
 *     اتكتب، من غير أي فحص تكرار — فالعيلة بتتلخبط بعد كام طلب.
 *   • وتاريخ الميلاد كان بيتلفّق: الخانة بتاخد سنة والكود بيحط أول يناير.
 *
 * الدالة دي هي المكان الواحد اللي بيحسم الحكاية: بترجّع رقم المشارك
 * واسمه الحقيقي، وبتعيد استخدام الملف الموجود بدل ما تعمل نسخة.
 */
export async function getWizardUserInfo(): Promise<{
  id?: string;
  fullName?: string;
  isVisitor: boolean;
}> {
  const { getCurrentUser } = await import('@/data/domains/auth');
  const user = await getCurrentUser();
  if (user.role === 'visitor') return { isVisitor: true };
  return { id: user.id, fullName: user.fullName, isVisitor: false };
}

export async function resolveWizardChild(params: {
  familyMemberId?: string;
  newChildName?: string;
  newChildBirthDate?: string;
  newChildGender?: 'male' | 'female' | '' | null;
}): Promise<{ childId?: string; childName: string }> {
  // ⚠️ دي كمان بتعمل صف طفل جديد — ومعالج الشراء بينادي عليها **قبل**
  //    `createOrder`. فحساب الطالب التابع كان يقدر يملا العيلة بملفات
  //    من غير ما يكمّل أي طلب: الشراء نفسه مقفول عليه، ودي مكانتش.
  const user = await requireNotDependent('الشراء');
  const supabase = await createClient();

  // (0) طلب لنفسه: الاسم هو اسم حسابه (أو الاسم المدخل لو عدّله)
  if (params.familyMemberId === 'self') {
    const name = (params.newChildName ?? '').trim() || user.fullName;
    return { childName: name };
  }

  // (1) اختار واحد من عيلته: الاسم بييجي من الملف نفسه، مش من الواجهة.
  if (params.familyMemberId) {
    const { data } = await supabase
      .from('child_profiles')
      .select('id, full_name')
      .eq('id', params.familyMemberId)
      .eq('user_profile_id', user.id)
      .maybeSingle();

    if (!data) throw new Error('ملف المشارك المختار غير موجود');
    return { childId: data.id, childName: data.full_name };
  }

  const name = (params.newChildName ?? '').trim();
  if (!name) throw new Error('اختار مشاركًا من العائلة أو أضف واحدًا جديدًا');

  const birthDate = (params.newChildBirthDate ?? '').trim() || null;

  // (2) نفس الاسم ونفس تاريخ الميلاد = نفس الطفل. بنعيد استخدامه بدل
  //     ما نعمل نسخة تانية في العيلة.
  const { data: existing } = await supabase
    .from('child_profiles')
    .select('id, full_name, birth_date')
    .eq('user_profile_id', user.id)
    .eq('full_name', name);

  const match = (existing ?? []).find(
    (c) => (c.birth_date ?? null) === birthDate,
  );

  if (match) {
    return { childId: match.id, childName: match.full_name };
  }

  const { data: created, error } = await supabase
    .from('child_profiles')
    .insert({
      user_profile_id: user.id,
      full_name: name,
      birth_date: birthDate,
      gender: params.newChildGender || null,
    })
    .select('id, full_name')
    .single();

  if (error || !created) {
    console.error('Error creating child from wizard', error);
    throw new Error('تعذّر حفظ بيانات المشارك');
  }

  revalidatePath('/account/family');
  return { childId: created.id, childName: created.full_name };
}
