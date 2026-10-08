'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import type { ProviderKind } from '@/types';

/**
 * إدارة مقدّمي الخدمة.
 *
 * ⚠️ الدوال دي **مش** الحارس. الحارس الحقيقي هو صلاحيات قاعدة البيانات
 * والمحفّزات اللي في ملف 30 — لأنها بتشتغل حتى لو حد كلّم قاعدة البيانات
 * مباشرة وتجاهل الموقع.
 *
 * ليه بترجّع الخطأ بدل ما ترميه:
 *   Next.js في الإنتاج بيخفي أي رسالة خطأ جاية من الخادم ويستبدلها بنص
 *   عام، عشان ما تتسربش تفاصيل حساسة. يعني رسالة زي «مفيش حساب بالبريد
 *   ده» ما بتوصلش للإدارة أصلًا — بيوصلها نص إنجليزي ما بيقولش حصل إيه.
 *
 *   فالرسائل اللي الإدارة المفروض تقراها بترجع كنتيجة عادية، والرمي
 *   بيفضل للأعطال الحقيقية اللي مالهاش رسالة مفيدة.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

function requireProvidersAdmin() {
  return requireAdmin('canManageInstructors', 'غير مصرح لك بإدارة مقدّمي الخدمة');
}

function revalidateProviders() {
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/creative-writing/services');
}

/** بيانات المقدّم اللي الإدارة بتعدّلها: الاسم والنبذة والحالة. */
export async function saveProviderDetails(params: {
  providerId: string;
  displayName: string;
  bio: string;
  status: 'pending' | 'active' | 'suspended';
}): Promise<ActionResult> {
  const admin = await requireProvidersAdmin();
  const name = params.displayName.trim();
  if (!name) return { ok: false, error: 'اكتب اسم مقدّم الخدمة' };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from('service_providers')
    .update({
      display_name: name,
      bio: params.bio.trim(),
      status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.providerId)
    .select('id');

  if (error) {
    console.error('Error saving provider', error);
    return { ok: false, error: `تعذّر حفظ بيانات مقدّم الخدمة: ${error.message}` };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'الحفظ مروّحش للقاعدة — مقدّم الخدمة مش موجود أو الصلاحيات مش سامحة.' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'service_provider_updated',
    entityType: 'ServiceProvider',
    entityId: params.providerId,
  });

  revalidateProviders();
  return { ok: true };
}

/**
 * إضافة مقدّم خدمة مستقل — مش مدرب.
 *
 * بيتربط بحساب موجود بالفعل عن طريق بريده. ما بننشئش حسابات من هنا:
 * إنشاء الحساب محتاج مفتاح الخدمة وله شاشته، والربط بحساب قايم أوضح
 * وأقل مفاجآت.
 */
export async function createIndividualProvider(params: {
  email: string;
  displayName: string;
  bio: string;
}): Promise<ActionResult> {
  const admin = await requireProvidersAdmin();
  const email = params.email.trim().toLowerCase();
  const name = params.displayName.trim();
  if (!email) return { ok: false, error: 'اكتب بريد صاحب الحساب' };
  if (!name) return { ok: false, error: 'اكتب اسم مقدّم الخدمة' };

  const supabase = await createClient();

  const { data: found, error: lookupError } = await supabase
    .from('user_emails')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('Error looking up email', lookupError);
    return { ok: false, error: `تعذّر البحث عن البريد: ${lookupError.message}` };
  }

  if (!found) {
    return {
      ok: false,
      error:
        'مفيش حساب بالبريد ده. اطلب منه يسجّل أولاً، أو أضِف المستخدم من شاشة المستخدمين.',
    };
  }

  // مدرب بالفعل؟ يبقى له صف مقدّم أصلًا، ومفيش داعي لصف تاني.
  const { data: asInstructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', found.user_id)
    .maybeSingle();

  if (asInstructor) {
    return {
      ok: false,
      error:
        'صاحب الحساب ده مدرب بالفعل، وله صف مقدّم خدمة جاهز. عدّل عروضه من نفس الشاشة.',
    };
  }

  const { error } = await supabase.from('service_providers').insert({
    kind: 'individual' as ProviderKind,
    user_id: found.user_id,
    display_name: name,
    bio: params.bio.trim(),
    // بيدخل معلّق: الإدارة بتفعّله بعد ما تراجع.
    status: 'pending',
    is_public: false,
  });

  if (error) {
    console.error('Error creating provider', error);
    // رسالة قاعدة البيانات نفسها بتتعرض: من غيرها الإدارة بتشوف «تعذّر»
    // وما تعرفش السبب — قيد تفرّد ولا صلاحية ولا حاجة تالتة.
    return { ok: false, error: `تعذّرت الإضافة: ${error.message}` };
  }

  // ترقية دور الحساب لـ«مقدّم خدمة» عشان الدخول يوديه على لوحته.
  // بنرقّي الأدوار العادية بس: مفيش خطر إننا ننزّل مشرفًا أو ناشرًا من
  // دوره من غير ما حد يقصد.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', found.user_id)
    .maybeSingle();

  // ⚠️ مش «طالب»: ده حساب طفل تابع لولي أمره، وترقيته كانت بتطلّعه من
  //    حماية الحساب العائلي.
  if (profile && ['visitor', 'customer'].includes(profile.role)) {
    const { error: roleError } = await supabase
      .from('user_profiles')
      .update({ role: 'service_provider', updated_at: new Date().toISOString() })
      .eq('id', found.user_id);
    // الدور مش شرط لعمل الصف: لو فشل، المقدّم اتضاف فعلًا والإدارة تقدر
    // تغيّر الدور من شاشة المستخدمين. فبنسجّل ولا نفشّل العملية.
    if (roleError) console.error('Error upgrading provider role', roleError);
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'service_provider_created',
    entityType: 'ServiceProvider',
    entityId: email,
  });

  revalidateProviders();
  return { ok: true };
}

/**
 * اعتماد عرض خدمة وتحديد سعره.
 *
 * السعر معناه بيختلف حسب نوع المقدّم — وده مكتوب في الشاشة كمان عشان
 * ما يتلخبطش:
 *   • المنصة: السعر ده **اللي العميل هيدفعه**.
 *   • مدرب أو مستقل: السعر ده **مستحقه هو**، والعميل بيدفع فوقه معادلة
 *     المنصة.
 */
export async function saveProviderOffering(params: {
  providerId: string;
  serviceId: string;
  approvedPrice: number | null;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  adminNotes?: string;
}): Promise<ActionResult> {
  const admin = await requireProvidersAdmin();

  const price = params.approvedPrice;
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return { ok: false, error: 'السعر غير صحيح' };
  }
  // عرض معتمد من غير سعر بيوصل للعميل كخيار بلا رقم.
  if (params.status === 'approved' && (price == null || price <= 0)) {
    return { ok: false, error: 'لا يمكن اعتماد عرض بدون سعر' };
  }

  const supabase = await createClient();
  const row = {
    provider_id: params.providerId,
    service_id: params.serviceId,
    approved_price: price,
    status: params.status,
    is_active: params.isActive,
    admin_notes: params.adminNotes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', params.providerId)
    .eq('service_id', params.serviceId)
    .maybeSingle();

  const { data: savedOffering, error } = existing
    ? await supabase.from('provider_services').update(row).eq('id', existing.id).select('id')
    : await supabase.from('provider_services').insert(row).select('id');

  if (error) {
    console.error('Error saving offering', error);
    return { ok: false, error: `تعذّر حفظ العرض: ${error.message}` };
  }
  if (!savedOffering || savedOffering.length === 0) {
    return { ok: false, error: 'العرض مروّحش للقاعدة — الصلاحيات مش سامحة بالتعديل.' };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'provider_offering_saved',
    entityType: 'ProviderService',
    entityId: `${params.providerId}:${params.serviceId}`,
  });

  revalidateProviders();
  return { ok: true };
}

/** إزالة عرض بالكامل — المقدّم يبقى مش بيقدّم الخدمة دي خالص. */
export async function removeProviderOffering(
  providerId: string,
  serviceId: string,
): Promise<ActionResult> {
  const admin = await requireProvidersAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('provider_id', providerId)
    .eq('service_id', serviceId);

  if (error) {
    console.error('Error removing offering', error);
    return { ok: false, error: `تعذّر حذف العرض: ${error.message}` };
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'provider_offering_removed',
    entityType: 'ProviderService',
    entityId: `${providerId}:${serviceId}`,
  });

  revalidateProviders();
  return { ok: true };
}
