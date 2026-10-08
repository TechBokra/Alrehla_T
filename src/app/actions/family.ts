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

/**
 * ⚠️ الدوال اللي بتكتب هنا **بترجّع** النتيجة بدل ما ترمي (قاعدة «هـ»):
 *    Next بيمسح نصّ الخطأ اللي بيترمي في الموقع المنشور، فرسالة زي
 *    «إضافة فرد للعائلة محتاجة موافقة ولي أمرك» كانت بتوصل إنجليزي عامة.
 */
export type FamilyResult = { ok: true } | { ok: false; error: string; field?: string };

/** الحارس بيرمي — هنا بنمسكه ونرجّع رسالته العربي. */
async function guardNotDependent(action: string) {
  try {
    return { ok: true as const, user: await requireNotDependent(action) };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error && err.message ? err.message : 'غير مصرح' };
  }
}

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
): Promise<{ ok: true; child: ChildProfile } | { ok: false; error: string; field?: string }> {
  const guard = await guardNotDependent('إضافة فرد للعائلة');
  if (!guard.ok) return { ok: false, error: guard.error };
  const { user } = guard;
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
    return { ok: false, error: 'تعذّر الإضافة — جرّب تاني' };
  }

  revalidatePath('/account/family');

  return {
    ok: true,
    child: {
      id: data.id,
      userProfileId: data.user_profile_id,
      fullName: data.full_name,
      birthDate: data.birth_date,
      gender: (data.gender as 'male' | 'female' | null) ?? null,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at
    },
  };
}

export async function updateFamilyMember(
  id: string,
  fullName: string,
  birthDate: string,
  gender?: 'male' | 'female' | null,
  avatarUrl?: string | null,
): Promise<FamilyResult> {
  const guard = await guardNotDependent('تعديل بيانات فرد العائلة');
  if (!guard.ok) return { ok: false, error: guard.error };
  const { user } = guard;
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
    return { ok: false, error: 'تعذّر الحفظ — جرّب تاني' };
  }

  // ⚠️ قاعدة (و): `UPDATE` على صف مش موجود بينجح بصفر صفوف وبلا خطأ.
  //    من غير الفحص ده الشاشة بتقول «اتحفظ» ومفيش حاجة وصلت.
  if (!data) {
    console.error('Child profile update matched zero rows', id);
    return { ok: false, error: 'تعذّر الحفظ — جرّب تاني' };
  }

  revalidatePath('/account/family');
  return { ok: true };
}

export async function deleteFamilyMember(id: string): Promise<FamilyResult> {
  const guard = await guardNotDependent('حذف فرد من العائلة');
  if (!guard.ok) return { ok: false, error: guard.error };
  const { user } = guard;
  const supabase = await createClient();

  const { error } = await supabase.from('child_profiles')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', user.id);

  if (error) {
    console.error('Error deleting child profile', error);
    return { ok: false, error: 'تعذّر الحذف — جرّب تاني' };
  }

  revalidatePath('/account/family');
  return { ok: true };
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
}): Promise<
  | { ok: true; childId?: string; childName: string }
  | { ok: false; error: string; field?: string }
> {
  // ⚠️ دي كمان بتعمل صف طفل جديد — ومعالج الشراء بينادي عليها **قبل**
  //    `createOrder`. فحساب الطالب التابع كان يقدر يملا العيلة بملفات
  //    من غير ما يكمّل أي طلب: الشراء نفسه مقفول عليه، ودي مكانتش.
  const guard = await guardNotDependent('الشراء');
  if (!guard.ok) return { ok: false, error: guard.error };
  const { user } = guard;
  const supabase = await createClient();

  // (0) طلب لنفسه: الاسم هو اسم حسابه (أو الاسم المدخل لو عدّله)
  if (params.familyMemberId === 'self') {
    const name = (params.newChildName ?? '').trim() || user.fullName;
    return { ok: true, childName: name };
  }

  // (1) اختار واحد من عيلته: الاسم بييجي من الملف نفسه، مش من الواجهة.
  if (params.familyMemberId) {
    const { data } = await supabase
      .from('child_profiles')
      .select('id, full_name')
      .eq('id', params.familyMemberId)
      .eq('user_profile_id', user.id)
      .maybeSingle();

    if (!data) return { ok: false, error: 'ملف المشارك المختار غير موجود', field: 'familyMemberId' };
    return { ok: true, childId: data.id, childName: data.full_name };
  }

  // (2) ⚠️ قرار تامر (اختبار «إنها لك» JKM9): **مفيش طفل جديد من جوه
  //     الطلب.** كان هنا بيتعمل ملف طفل بالاسم والميلاد اللي في المعالج.
  //     دلوقتي الطفل بيتضاف من «المركز العائلي» بس — والمعالج بيختار منه.
  return {
    ok: false,
    error: 'اختار من أفراد العائلة — ولو الطفل مش موجود، ضيفه الأول من «المركز العائلي».',
    field: 'familyMemberId',
  };
}
