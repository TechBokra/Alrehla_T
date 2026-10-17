'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { logAuditAction } from '@/lib/audit';
import { parseAdInput, isAdPlacement } from '@/lib/ads';
import { cairoLocalToIso } from '@/lib/promotions';

/**
 * إدارة الإعلانات.
 *
 * ⚠️ **الدوال بترجّع `{ok,error}` ولا بترمي** (قاعدة «هـ») — Next
 *    بيمسح نصّ الاستثناء في الإنتاج، فرسالة زي «اختر مكانًا» كانت
 *    بتوصل للإدارة «خطأ غير متوقع».
 */
export type AdResult = { ok: true; id: string } | { ok: false; error: string };

const DENIED = 'غير مصرح لك بإدارة الإعلانات';
const ADMIN_PATH = '/dashboard/admin/content/ads';

/**
 * ⚠️ **الوقت بيتحوّل من توقيت القاهرة.** خانة `datetime-local`
 *    بترجع «2026-10-20T21:00» من غير منطقة زمنية. لو اتخزّنت زي ما
 *    هي بيقراها الخادم UTC، والإدارة اللي كتبت ٩ بالليل بالقاهرة
 *    يبدأ إعلانها **١٢ بالليل** — ساعتين أو تلاتة فرق على حسب
 *    التوقيت الصيفي. `cairoLocalToIso` بتحسب الفرق الصح.
 */
function toIso(local: unknown): string | null {
  const text = String(local ?? '').trim();
  if (!text) return null;
  return cairoLocalToIso(text);
}

/** إضافة إعلان أو تعديله. `id` فاضي = إضافة. */
export async function saveAd(formData: FormData): Promise<AdResult> {
  let user;
  try {
    user = await requireAdmin('canManageContent', DENIED);
  } catch {
    return { ok: false, error: DENIED };
  }

  const id = String(formData.get('id') ?? '').trim();

  // ⚠️ التواريخ بتتحوّل **قبل** التحقق، عشان مقارنة «النهاية بعد
  //    البداية» تحصل على نفس القيم اللي هتتخزّن.
  const startsAtRaw = formData.get('startsAt');
  const endsAtRaw = formData.get('endsAt');
  const startsAt = toIso(startsAtRaw);
  const endsAt = toIso(endsAtRaw);
  if (String(startsAtRaw ?? '').trim() && !startsAt) {
    return { ok: false, error: 'تاريخ البداية مش مقروء.' };
  }
  if (String(endsAtRaw ?? '').trim() && !endsAt) {
    return { ok: false, error: 'تاريخ النهاية مش مقروء.' };
  }

  const parsed = parseAdInput({
    title: formData.get('title'),
    advertiserName: formData.get('advertiserName'),
    imageUrl: formData.get('imageUrl'),
    imageUrlMobile: formData.get('imageUrlMobile'),
    linkUrl: formData.get('linkUrl'),
    // ⚠️ `getAll` مش `get`: الخانات مربّعات اختيار متعددة بنفس الاسم.
    placements: formData.getAll('placements').filter(isAdPlacement),
    startsAt,
    endsAt,
    isActive: formData.get('isActive'),
    sortOrder: formData.get('sortOrder'),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  const supabase = await createClient();
  const row = {
    title: v.title,
    advertiser_name: v.advertiserName,
    image_url: v.imageUrl,
    image_url_mobile: v.imageUrlMobile,
    link_url: v.linkUrl,
    placements: v.placements,
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    is_active: v.isActive,
    sort_order: v.sortOrder,
  };

  // ⚠️ `.select('id')` على التعديل مش رفاهية: `update` على صف مش
  //    موجود **بينجح وبيغيّر صفر صفوف** (قاعدة «و»)، فالشاشة كانت
  //    هتقول «اتحفظ» وما اتحفظش حاجة.
  const { data, error } = id
    ? await supabase.from('ads').update(row).eq('id', id).select('id')
    : await supabase.from('ads').insert(row).select('id');

  if (error) {
    console.error('Error saving ad', error);
    return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: id
        ? 'الإعلان مش موجود — يمكن اتمسح من متصفح تاني.'
        : 'الحفظ مروّحش للقاعدة — صلاحيات جدول الإعلانات مش سامحة بالكتابة.',
    };
  }

  const savedId = data[0].id as string;

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: id ? 'ad_updated' : 'ad_created',
    entityType: 'Ad',
    entityId: savedId,
    metadata: { title: v.title, placements: v.placements, isActive: v.isActive },
  });

  revalidatePath(ADMIN_PATH);
  // الإعلان بيظهر للزوّار، فالصفحات العامة لازم تتحدّث.
  refreshPublicPages();
  return { ok: true, id: savedId };
}

/** تشغيل/إيقاف إعلان من القايمة من غير فتح الفورم. */
export async function toggleAd(id: string, isActive: boolean): Promise<AdResult> {
  let user;
  try {
    user = await requireAdmin('canManageContent', DENIED);
  } catch {
    return { ok: false, error: DENIED };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ads')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error toggling ad', error);
    return { ok: false, error: `تعذّر التعديل: ${error.message}` };
  }
  if (!data || data.length === 0) return { ok: false, error: 'الإعلان مش موجود.' };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: isActive ? 'ad_resumed' : 'ad_paused',
    entityType: 'Ad',
    entityId: id,
    metadata: { isActive },
  });

  revalidatePath(ADMIN_PATH);
  refreshPublicPages();
  return { ok: true, id };
}

/**
 * حذف إعلان.
 *
 * ⚠️ **بيحذف نقراته معاه** (`on delete cascade` في القاعدة) — العدد
 *    من غير الإعلان مالوش معنى. فلو الإدارة محتاجة ترجع للأرقام،
 *    الإيقاف أصحّ من الحذف، والشاشة بتقول كده.
 */
export async function deleteAd(id: string): Promise<AdResult> {
  let user;
  try {
    user = await requireAdmin('canManageContent', DENIED);
  } catch {
    return { ok: false, error: DENIED };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('ads').delete().eq('id', id).select('id');

  if (error) {
    console.error('Error deleting ad', error);
    return { ok: false, error: `تعذّر الحذف: ${error.message}` };
  }
  if (!data || data.length === 0) return { ok: false, error: 'الإعلان مش موجود.' };

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'ad_deleted',
    entityType: 'Ad',
    entityId: id,
  });

  revalidatePath(ADMIN_PATH);
  refreshPublicPages();
  return { ok: true, id };
}

/**
 * تسجيل نقرة.
 *
 * ⚠️ **بيستعمل العميل العام عن قصد**: الزائر المجهول هو اللي بيدوس،
 *    وسياسة القاعدة بتسمح له بالكتابة بس (مابيقراش ولا نقرة).
 *
 * ⚠️ **وبيرجّع ولا بيرمي، والنقرة الفاشلة مابتوقفش التحويل.** اللي
 *    داس عايز يوصل للمعلن؛ نقرة مش محسوبة أهون من زائر واقف على
 *    صفحة خطأ. الفشل بيتسجّل في اللوج.
 */
export async function recordAdClick(adId: string, placement: string | null): Promise<void> {
  try {
    const supabase = createPublicClient();
    const { error } = await supabase.from('ad_clicks').insert({
      ad_id: adId,
      placement: placement && isAdPlacement(placement) ? placement : null,
    });
    if (error) console.error('Error recording ad click', error);
  } catch (err) {
    console.error('Error recording ad click', err);
  }
}
