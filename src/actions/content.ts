'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { CONTENT_DEFAULTS, CONTENT_FIELDS } from '@/lib/site-content';

/**
 * Site-wide settings (contact email, social links).
 *
 * This used to assign onto an in-memory object, so an admin could change the
 * contact email, see it saved, and find it reverted after the next restart.
 * It now updates the single `site_settings` row the footer reads.
 */
import { DEFAULT_RETENTION_DAYS } from '@/lib/session-recording';

export type SiteSettingsResult = { ok: true } | { ok: false; error: string };

export async function updateSiteSettings(
  _prev: SiteSettingsResult | null,
  formData: FormData,
): Promise<SiteSettingsResult> {
  let user;
  try {
    user = await requireAdmin('canManageContent', 'غير مصرح لك بتعديل إعدادات الموقع');
  } catch {
    return { ok: false, error: 'غير مصرح لك بتعديل إعدادات الموقع' };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .single();

  const current = (existing?.value ?? {}) as Record<string, unknown>;

  // الحقل اللي الفورم ما بعتوش أصلًا بيفضل زي ما هو — عشان حفظ جزئي
  // ما يمسحش إعدادات مش موجودة في الشاشة.
  //
  // بس الحقل اللي اتبعت **فاضي** بيتمسح فعلًا. قبل كده الفاضي كان
  // بيتجاهَل، يعني رقم تليفون اتكتب بالغلط ما كانش فيه طريقة تشيله من
  // الموقع خالص.
  const next: Record<string, unknown> = { ...current };
  for (const field of [
    'siteName',
    'contactEmail',
    'facebookUrl',
    'instagramUrl',
    'paymentWalletNumber',
    'contactPhone',
    'whatsappNumber',
    'address',
    'workingHours',
  ]) {
    const value = formData.get(field);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // رقم المحفظة استثناء: فاضي بيرجّع الافتراضي، وده أخطر من إنه
      // يفضل زي ما هو. فبنرفض الفاضي فيه.
      if (trimmed === '' && field === 'paymentWalletNumber') continue;
      if (trimmed === '') delete next[field];
      else next[field] = trimmed;
    }
  }

  // حد تنبيه سعر المدرب. **تنبيه لا منع** — فوقه المدرب يشوف رسالة
  // ويقدر يكمل، والإدارة بتراجع الرقم زي أي رقم تاني. صفر أو فاضي =
  // مفيش تنبيه.
  if (formData.has('instructorPriceAlert')) {
    const raw = String(formData.get('instructorPriceAlert') ?? '').trim();
    const parsed = Number(raw);
    if (raw === '' || !Number.isFinite(parsed) || parsed <= 0) {
      delete next.instructorPriceAlert;
    } else {
      next.instructorPriceAlert = parsed;
    }
  }

  // تسجيل الجلسات — التفعيل والمدة مع بعض.
  //
  // ⚠️ **المدة بتتفحص هنا مش في الشاشة بس** (قاعدة «ع»): رقم سالب أو
  //    صفر معناه «احذف التسجيل فورًا»، ورقم ضخم معناه احتفاظ بلا
  //    نهاية — والاتنين وعد غلط لولي أمر. الحد من يوم لسنة.
  if (formData.has('recordingRetentionDays')) {
    const raw = String(formData.get('recordingRetentionDays') ?? '').trim();
    const parsed = Math.trunc(Number(raw));
    const days =
      Number.isFinite(parsed) && parsed >= 1 && parsed <= 365 ? parsed : DEFAULT_RETENTION_DAYS;

    next.sessionRecording = {
      enabled: formData.get('recordingEnabled') === 'on',
      retentionDays: days,
    };
  }

  // شريط التنبيه العلوي — كائن واحد عشان التلات حاجات يتحفظوا مع بعض.
  if (formData.has('announcementText')) {
    const text = String(formData.get('announcementText') ?? '').trim();
    const until = String(formData.get('announcementUntil') ?? '').trim();
    next.announcement = {
      // الشريط ما بيتفعّلش من غير نص، مهما كان الزرار متظبط.
      enabled: formData.get('announcementEnabled') === 'on' && text !== '',
      text,
      until,
    };
  }

  // upsert مش update.
  //
  // `update` على صف مش موجود بينجح ومبيغيّرش أي حاجة — صفر صفوف، صفر
  // أخطاء. فالشاشة كانت بتقفل الفورم كأن كل حاجة تمام، والقيم ترجع زي
  // ما هي بعد التحديث. لو صف `general` مش موجود في القاعدة، ده بالظبط
  // اللي كان بيحصل.
  const { data: saved, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'general', value: next as never }, { onConflict: 'key' })
    .select('key');

  if (error) {
    console.error('Error updating site settings', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }

  // صفر صفوف من غير خطأ = صلاحيات القاعدة رفضت الكتابة بصمت.
  if (!saved || saved.length === 0) {
    return {
      ok: false,
      error: 'الحفظ مروّحش للقاعدة — صلاحيات جدول الإعدادات مش سامحة بالكتابة.',
    };
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'site_settings_updated',
    entityType: 'SiteSettings',
    entityId: 'general',
    metadata: next,
  });

  revalidatePath('/dashboard/admin/content/settings');
  revalidatePath('/enha-lak/checkout');
  revalidatePath('/creative-writing/booking/confirm');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Saving one image, or the payment QR, into the site settings.
 *
 * Kept separate from the settings form so a single upload is one write, and a
 * partial save can never blank out the other slots.
 */
export async function saveSiteImage(params: { key: string; url: string }) {
  const user = await requireAdmin('canManageContent', 'غير مصرح لك بتعديل صور الموقع');

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'general')
    .single();

  const current = (existing?.value ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };

  if (params.key === 'paymentQrUrl') {
    next.paymentQrUrl = params.url.trim();
  } else {
    const images = { ...((current.images ?? {}) as Record<string, string>) };
    if (params.url.trim()) images[params.key] = params.url.trim();
    else delete images[params.key];
    next.images = images;
  }

  // نفس سبب الـ upsert فوق: صف مش موجود = حفظ بيعدّي من غير ما يكتب حاجة.
  const { data: saved, error } = await supabase
    .from('site_settings')
    .upsert({ key: 'general', value: next as never }, { onConflict: 'key' })
    .select('key');

  if (error) {
    console.error('Error saving site image', error);
    throw new Error(`تعذّر حفظ الصورة: ${error.message}`);
  }

  if (!saved || saved.length === 0) {
    throw new Error('الحفظ مروّحش للقاعدة — صلاحيات جدول الإعدادات مش سامحة بالكتابة.');
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: params.url.trim() ? 'site_image_updated' : 'site_image_removed',
    entityType: 'SiteSettings',
    entityId: params.key,
  });

  revalidatePath('/dashboard/admin/content/images');
  revalidatePath('/dashboard/admin/content/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * حفظ نصوص صفحة واحدة.
 *
 * بيتكتب صف لكل نص اتغيّر فعلًا. لو النص رجع زي الأصلي بالظبط، الصف
 * بيتمسح بدل ما يتخزّن — فالجدول بيفضل فيه اللي اتعدّل بس، و«استعادة النص
 * الأصلي» بتشتغل من غير أي منطق إضافي.
 */
export async function savePageContent(
  entries: { key: string; value: string }[],
) {
  const user = await requireAdmin('canManageContent', 'غير مصرح لك بتعديل محتوى الصفحات');

  // مفتاح مش معرّف في الكود مالوش أي مكان في الموقع — رفضه أحسن من
  // تخزين صف ميّت في الجدول.
  const known = new Set(CONTENT_FIELDS.map((f) => f.key));
  const clean = entries.filter((e) => known.has(e.key));
  if (clean.length === 0) return { ok: true, changed: 0 };

  const supabase = await createClient();

  const toUpsert: { key: string; value: string; updated_by: string; updated_at: string }[] = [];
  const toDelete: string[] = [];

  for (const entry of clean) {
    const value = entry.value.replace(/\r\n/g, '\n').trim();
    if (value === '' || value === CONTENT_DEFAULTS[entry.key].trim()) {
      toDelete.push(entry.key);
    } else {
      toUpsert.push({
        key: entry.key,
        value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('page_content')
      .upsert(toUpsert, { onConflict: 'key' });
    if (error) {
      console.error('Error saving page content', error);
      throw new Error('تعذّر حفظ النصوص');
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('page_content')
      .delete()
      .in('key', toDelete);
    if (error) {
      console.error('Error resetting page content', error);
      throw new Error('تعذّر استعادة النص الأصلي');
    }
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'page_content_updated',
    entityType: 'PageContent',
    entityId: clean.map((e) => e.key).join(','),
    metadata: { edited: toUpsert.length, restored: toDelete.length },
  });

  // النصوص دي بتظهر في صفحات عامة كتير، فالتحديث على مستوى الموقع كله.
  revalidatePath('/', 'layout');
  revalidatePath('/dashboard/admin/content/pages');

  return { ok: true, changed: clean.length };
}

/**
 * آراء العملاء.
 *
 * الجدول كان موجودًا والصفحات بتقرأ منه، لكن مفيش شاشة تكتب فيه — فقسم
 * «ماذا يقولون عنا» كان بيقول «قريبًا» للأبد.
 */
export async function saveTestimonial(
  id: string | null,
  data: { authorName: string; authorRole: string; content: string },
) {
  const user = await requireAdmin('canManageContent', 'غير مصرح لك بتعديل آراء العملاء');

  const authorName = data.authorName.trim();
  const authorRole = data.authorRole.trim();
  const body = data.content.trim();

  if (!authorName || !body) {
    throw new Error('الاسم ونص الرأي مطلوبان');
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from('testimonials')
      .update({ author_name: authorName, author_role: authorRole, content: body })
      .eq('id', id);
    if (error) {
      console.error('Error updating testimonial', error);
      throw new Error('تعذّر حفظ الرأي');
    }
  } else {
    const { error } = await supabase
      .from('testimonials')
      .insert({ author_name: authorName, author_role: authorRole, content: body });
    if (error) {
      console.error('Error creating testimonial', error);
      throw new Error('تعذّر إضافة الرأي');
    }
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: id ? 'testimonial_updated' : 'testimonial_created',
    entityType: 'Testimonial',
    entityId: id ?? authorName,
  });

  revalidatePath('/dashboard/admin/content/testimonials');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteTestimonial(id: string) {
  const user = await requireAdmin('canManageContent', 'غير مصرح لك بحذف آراء العملاء');

  const supabase = await createClient();
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) {
    console.error('Error deleting testimonial', error);
    throw new Error('تعذّر حذف الرأي');
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'testimonial_deleted',
    entityType: 'Testimonial',
    entityId: id,
  });

  revalidatePath('/dashboard/admin/content/testimonials');
  revalidatePath('/', 'layout');
  return { ok: true };
}
