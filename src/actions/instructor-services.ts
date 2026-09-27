'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/data/domains/auth';
import { getMyInstructorId } from '@/data/domains/services';
import { notifyUser, getInstructorUserId } from '@/lib/notifications';

/**
 * عروض المدربين للخدمات الإبداعية — مين بيقدّم إيه وبكام.
 *
 * ── ليه الملف ده اتغيّر بالكامل ──────────────────────────────
 *
 * كان بيكتب في `instructor_services`، والبيع بيقرا من
 * `provider_services`. جدولين بأعمدة متطابقة حرفيًا ما عدا العمود
 * الأول، ومفيش ولا سطر في المشروع بينقل بينهم.
 *
 * السبب اتكشف في ملف SQL رقم 30: هو عمل **نسخة لمرة واحدة** من
 * `instructor_services` لـ`provider_services`، مش محفّز مستمر. فكل عرض
 * اتعمل بعد الملف ده فضل في الجدول القديم وحده — يعني معتمد ومفعّل في
 * لوحة المدرب وفي لوحة الإدارة، و**العميل لا يشوفه ولا يقدر يطلبه
 * أبدًا**. تشخيص ملف 62 لقى الحالة دي فعلًا على القاعدة الحقيقية.
 *
 * دلوقتي كل حاجة هنا بتكتب في `provider_services` — نفس الجدول اللي
 * `createServiceOrder` وصفحة الخدمة العامة بيقروا منه. مفيش نسخة تانية
 * تسيب.
 *
 * `service_providers.kind` بيسمح بمقدّم مش مدرب (المنصة نفسها، أو
 * مستقل)، وعشان كده هو المعتمد — الاتجاه التاني كان هيلغي ده.
 *
 * ── التحقق ───────────────────────────────────────────────────
 *
 * بيتم مرتين بقصد: هنا عشان المستخدم يشوف رسالة مفهومة، وتاني في
 * صلاحيات القاعدة على `provider_services`. الكود هنا **مش** الحارس.
 */

/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireInstructorAdmin() {
  return requireAdmin('canManageCatalog', 'غير مصرح لك بإدارة عروض المدربين');
}

/**
 * صف مقدّم الخدمة بتاع المدرب — وبيعمله لو مش موجود.
 *
 * ملف 30 عمل صف لكل مدرب كان موجود وقتها، ومفيش أي حاجة بتعمل صف لمدرب
 * جديد بعد كده. فمن غير الدالة دي، أول مدرب يتضاف بعد ملف 30 يبقى
 * عنده نفس المشكلة من أول وجديد: عروضه مالهاش مكان في مسار البيع.
 *
 * حالة المقدّم بتتبع حالة المدرب — نفس القاعدة اللي في ملف 30 بالظبط.
 */
async function resolveProviderId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instructorId: string,
): Promise<{ ok: true; providerId: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('service_providers')
    .select('id')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (existing) return { ok: true, providerId: existing.id };

  const { data: instructor } = await supabase
    .from('instructors')
    .select('display_name, bio, status')
    .eq('id', instructorId)
    .maybeSingle();

  if (!instructor) return { ok: false, error: 'المدرب مش موجود' };

  // ⚠️ **كان هنا مفتاح الخدمة، والتعليق بيقول إن السياسة بتمنع.**
  //
  //    التشخيص (ملف 103) قال إن السياسات كانت سامحة في **أغلب**
  //    الدوال أصلًا — القراءة والتعديل والاقتراح كلهم مفتوحين
  //    للمدرب على صفوفه. الفجوة الحقيقية كانت اتنين بس: إنشاء صف
  //    مقدّم الخدمة، وحذف عرض لسه معلّق. واتفتحوا بسياستين
  //    محدودتين في ملف 104.
  //
  //    فالكود رجع لصلاحيات المستخدم، والقاعدة رجعت تبقى الحارس —
  //    وده مبدأ مكتوب في `auth-guard.ts`: الصلاحيات بتشتغل حتى لو
  //    حد تجاهل الموقع وكلّم القاعدة مباشرة.
  //
  // ⚠️ **والسياسة بتفرض `status = 'pending'`** على الصف الجديد:
  //    من غيرها المدرب كان يقدر يعمل صفّه `active` ويحط نفسه في
  //    سوق الخدمات بلا اعتماد.
  const { data: created, error } = await supabase
    .from('service_providers')
    .insert({
      kind: 'instructor' as const,
      instructor_id: instructorId,
      display_name: instructor.display_name,
      bio: instructor.bio ?? '',
      status: instructor.status === 'active' ? ('active' as const) : ('pending' as const),
    })
    .select('id')
    .maybeSingle();

  if (error || !created) {
    console.error('Error creating provider row for instructor', error);
    // محاولة قراءة ثانية في حالة الإنشاء المتزامن:
    const { data: retry } = await supabase
      .from('service_providers')
      .select('id')
      .eq('instructor_id', instructorId)
      .maybeSingle();

    if (retry) return { ok: true, providerId: retry.id };

    return {
      ok: false,
      error: `حسابك مش مربوط بملف مقدّم خدمة، والربط التلقائي فشل: ${error?.message ?? ''}`,
    };
  }

  return { ok: true, providerId: created.id };
}

export async function saveInstructorServiceOffer(params: {
  instructorId: string;
  serviceId: string;
  approvedPrice: number | null;
  isActive: boolean;
  adminNotes?: string;
}) {
  await requireInstructorAdmin();
  const supabase = await createClient();

  const { instructorId, serviceId, approvedPrice, isActive, adminNotes } = params;

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  // A price is what makes the offer real; without one it stays pending so it
  // never reaches a visitor half-configured.
  const status = approvedPrice != null && approvedPrice > 0 ? 'approved' : 'pending';

  const { data: saved, error } = await supabase
    .from('provider_services')
    .upsert(
      {
        provider_id: provider.providerId,
        service_id: serviceId,
        approved_price: approvedPrice,
        status,
        is_active: isActive,
        admin_notes: adminNotes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider_id,service_id' }
    )
    .select('id');

  if (error) {
    console.error('Error saving instructor service offer', error);
    throw new Error(`تعذّر حفظ الخدمة: ${error.message}`);
  }
  if (!saved || saved.length === 0) {
    throw new Error('الحفظ مروّحش للقاعدة — الصلاحيات مش سامحة بالتعديل.');
  }

  await notifyUser({
    event: 'instructor_profile',
    recipientProfileId: await getInstructorUserId(instructorId),
    title: status === 'approved' ? 'تم اعتماد خدمتك' : 'تحديث على خدمتك',
    message:
      status === 'approved'
        ? `اعتمدت الإدارة حصيلتك في هذه الخدمة${approvedPrice != null ? ` بمبلغ ${approvedPrice} ج.م` : ''}.`
        : 'الخدمة ما زالت قيد المراجعة.',
    link: '/dashboard/instructor/services',
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/creative-writing/services');
  revalidatePath('/dashboard/instructor/services');
  return { ok: true };
}

export async function removeInstructorServiceOffer(
  instructorId: string,
  serviceId: string
) {
  await requireInstructorAdmin();
  const supabase = await createClient();

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('provider_id', provider.providerId)
    .eq('service_id', serviceId);

  if (error) {
    console.error('Error removing instructor service offer', error);
    throw new Error(`تعذّر حذف الخدمة: ${error.message}`);
  }

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/creative-writing/services');
  return { ok: true };
}

/** رفض طلب المدرب مع ملاحظة توضّح السبب. */
export async function rejectInstructorServiceOffer(
  instructorId: string,
  serviceId: string,
  adminNotes: string
) {
  await requireInstructorAdmin();
  if (!adminNotes.trim()) {
    throw new Error('اكتب سبب الرفض ليصل للمدرب');
  }

  const supabase = await createClient();

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  const { data: rejected, error } = await supabase
    .from('provider_services')
    .update({
      status: 'rejected',
      approved_price: null,
      is_active: false,
      admin_notes: adminNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('provider_id', provider.providerId)
    .eq('service_id', serviceId)
    .select('id');

  if (error) {
    console.error('Error rejecting instructor service offer', error);
    throw new Error(`تعذّر رفض الطلب: ${error.message}`);
  }
  // صفر صفوف = مفيش عرض بالمفتاحين دول. من غير الفحص ده الإدارة بتشوف
  // «اترفض» وبيوصل للمدرب إشعار رفض، والعرض لسه معتمد في القاعدة.
  if (!rejected || rejected.length === 0) {
    throw new Error('العرض ده مش موجود — الرفض مروّحش للقاعدة.');
  }

  await notifyUser({
    event: 'instructor_profile',
    recipientProfileId: await getInstructorUserId(instructorId),
    title: 'لم تُعتمد الخدمة',
    message: adminNotes.trim(),
    link: '/dashboard/instructor/services',
  });

  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/dashboard/instructor/services');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}

/* ================================================================
 * الجانب الخاص بالمدرب
 * ================================================================
 * المدرب يطلب تقديم خدمة ويقترح حصيلته، ويوقف خدمته مؤقتًا.
 *
 * ما لا يستطيعه هنا: اعتماد نفسه، أو كتابة السعر المعتمد. هذا مفروض
 * بمُشغِّل في قاعدة البيانات، لا بهذا الملف — الكود هنا للرسالة الواضحة فقط.
 */

async function requireOwnInstructorId(): Promise<string> {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') {
    throw new Error('هذه الصفحة للمدربين فقط');
  }
  const instructorId = await getMyInstructorId();
  if (!instructorId) {
    throw new Error('لم يتم ربط حسابك بملف مدرب بعد');
  }
  return instructorId;
}

/**
 * السعر لازم يكون رقم موجب — وبس.
 *
 * كان فيه سقف ثابت (مليون) بيرفض الطلب. مفيش رقم صح يصلح سقفًا لكل
 * الخدمات، وكل عرض بيتراجع من الإدارة يدويًا قبل ما يتعتمد أصلًا.
 * الحد اللي الإدارة بتحطه في الإعدادات **بينبّه** المدرب في الشاشة
 * ومابيمنعوش.
 */
function validatePrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('السعر لازم يكون رقم أكبر من صفر');
  }
}

/**
 * «أقدّم هذه الخدمة» — طلب جديد، أو تعديل السعر المقترح على طلب قائم.
 *
 * المبلغ المقترح هو **حصيلة المدرب**، لا ما يدفعه العميل: سعر العميل يُحسب
 * بمعادلة المنصة فوقه، تمامًا كما في تسعير الجلسات.
 */
export async function proposeServiceOffer(serviceId: string, requestedPrice: number) {
  const instructorId = await requireOwnInstructorId();
  validatePrice(requestedPrice);

  const supabase = await createClient();

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  const { data: existing } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', provider.providerId)
    .eq('service_id', serviceId)
    .maybeSingle();

  // تعديل السعر المقترح لا يُنزل الحالة من "معتمدة" — الخدمة تظل معروضة
  // للعملاء بالسعر المعتمد القديم حتى تعتمد الإدارة السعر الجديد.
  const { data: saved, error } = existing
    ? await supabase
        .from('provider_services')
        .update({ requested_price: requestedPrice, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id')
    : await supabase
        .from('provider_services')
        .insert({
          provider_id: provider.providerId,
          service_id: serviceId,
          requested_price: requestedPrice,
          status: 'pending',
          is_active: true,
        })
        .select('id');

  if (error) {
    console.error('Error proposing service offer', error);
    throw new Error(`تعذّر إرسال الطلب: ${error.message}`);
  }
  if (!saved || saved.length === 0) {
    throw new Error('الطلب مروّحش للقاعدة — صلاحيات الحساب مش سامحة.');
  }

  revalidatePath('/dashboard/instructor/services');
  revalidatePath(`/dashboard/admin/instructors/${instructorId}`);
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}

/** إيقاف مؤقت أو إعادة تفعيل — بيد المدرب، وتخفي خدمته من قائمة العملاء. */
export async function setMyOfferActive(serviceId: string, isActive: boolean) {
  const instructorId = await requireOwnInstructorId();
  const supabase = await createClient();

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  const { data: toggled, error } = await supabase
    .from('provider_services')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('provider_id', provider.providerId)
    .eq('service_id', serviceId)
    .select('id');

  if (error) {
    console.error('Error toggling offer', error);
    throw new Error(`تعذّر تغيير حالة الخدمة: ${error.message}`);
  }
  if (!toggled || toggled.length === 0) {
    throw new Error('مفيش عرض بالخدمة دي على حسابك — التغيير مروّحش للقاعدة.');
  }

  revalidatePath('/dashboard/instructor/services');
  revalidatePath('/creative-writing/services');
  return { ok: true };
}

/** سحب طلب لم تبتّ فيه الإدارة بعد. */
export async function withdrawMyOffer(serviceId: string) {
  const instructorId = await requireOwnInstructorId();
  const supabase = await createClient();

  const provider = await resolveProviderId(supabase, instructorId);
  if (!provider.ok) throw new Error(provider.error);

  const { data: offer } = await supabase
    .from('provider_services')
    .select('id, status')
    .eq('provider_id', provider.providerId)
    .eq('service_id', serviceId)
    .maybeSingle();

  if (!offer) throw new Error('الطلب غير موجود');
  if (offer.status === 'approved') {
    throw new Error('الخدمة معتمدة — استخدم «إيقاف مؤقت» بدل السحب');
  }

  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', offer.id);

  if (error) {
    console.error('Error withdrawing offer', error);
    throw new Error(`تعذّر سحب الطلب: ${error.message}`);
  }

  revalidatePath('/dashboard/instructor/services');
  revalidatePath('/dashboard/admin/providers');
  revalidatePath('/dashboard/admin');
  return { ok: true };
}
