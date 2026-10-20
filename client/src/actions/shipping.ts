'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import {
  COUNTRY_CODE_PATTERN as COUNTRY_CODE,
  MAX_DELIVERY_MESSAGE as MAX_MESSAGE,
  validateShippingArea,
} from '@/lib/shipping-validation';

/**
 * التوصيل: الدول ← المحافظات ← المناطق وأسعارها، وفتح/إغلاق كل مستوى،
 * وإيقاف التوصيل العام — كله من لوحة الأدمن.
 *
 * Checkout used to charge a flat 50 EGP written into the code. The fee now
 * comes from these tables, which means they have to be editable somewhere
 * other than the database console.
 *
 * ⚠️ الفتح والإغلاق هنا **إعداد** فقط. اللي بيفرضه فعلًا هو `shipping_quote`
 *    جوّه `create_customer_order` / `create_box_subscription_order` في
 *    القاعدة — فمفيش طلب مباشر للقاعدة يتخطّى إغلاق دولة أو منطقة.
 */

/**
 * ⚠️ **كل الدوال هنا بترجّع ولا بترمي** (قاعدة «هـ»). كانت بترمي،
 *    وNext بيمسح نصّ الاستثناء في الإنتاج — فالإداري اللي كتب سعرًا
 *    غلط كان بيشوف «حدث خطأ غير متوقع» بدل «السعر غير صحيح».
 */
export type ShippingResult = { ok: true; updated?: number } | { ok: false; error: string };

const fail = (error: string): ShippingResult => ({ ok: false, error });


/** يفوّض للقاعدة الموحّدة في `@/lib/auth-guard` — التنفيذ واحد، والرسالة خاصة بهذا المجال. */
async function requireOrdersAdmin() {
  // ⚠️ `requireAdmin` بترمي — فبتتلفّ هنا وترجع `null` (قاعدة «هـ»).
  try {
    return await requireAdmin('canManageOrders', 'غير مصرح لك بإدارة أسعار الشحن');
  } catch {
    return null;
  }
}

function refreshShippingPages() {
  revalidatePath('/dashboard/admin/settings/shipping');
  refreshPublicPages();
}

export async function upsertShippingRate(params: {
  id?: string;
  countryCode: string;
  governorate: string;
  city: string;
  fee: number;
  isActive: boolean;
  isEstimate: boolean;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const checked = validateShippingArea(params.countryCode, params.governorate, params.city, params.fee);
  if (!checked.ok) return fail(checked.error);
  const { country, gov, area } = checked;
  const supabase = await createClient();

  const row = {
    country_code: country,
    governorate: gov,
    city: area,
    fee: params.fee,
    is_active: params.isActive,
    is_estimate: params.isEstimate,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = params.id
    ? await supabase.from('shipping_rates').update(row).eq('id', params.id).select('id')
    : await supabase
        .from('shipping_rates')
        .upsert(row, { onConflict: 'country_code,governorate,city' })
        .select('id');

  if (error) {
    console.error('Error saving shipping rate', error);
    // 23503 = المحافظة مش مسجّلة في الدولة دي (المفتاح الأجنبي).
    if (error.code === '23503') {
      return fail('المحافظة غير مسجّلة في هذه الدولة — أضِفها أولًا.');
    }
    return fail('تعذّر حفظ السعر');
  }
  // قاعدة «و»: التعديل على صف مش موجود بينجح ويرجّع صفر صفوف.
  if (!saved || saved.length === 0) {
    return fail('الحفظ مروّحش للقاعدة — المنطقة مش موجودة أو الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: params.id ? 'shipping_rate_updated' : 'shipping_rate_created',
    entityType: 'ShippingRate',
    entityId: params.id ?? `${country}/${gov}/${area}`,
    metadata: {
      countryCode: country,
      governorate: gov,
      city: area,
      fee: params.fee,
      isActive: params.isActive,
      isEstimate: params.isEstimate,
    },
  });

  refreshShippingPages();
  return { ok: true };
}

/**
 * إيقاف منطقة شحن أو تشغيلها.
 *
 * ⚠️ **كانت «حذف نهائي» بزرار سلة مهملات من غير تأكيد** — ضغطة غلط
 *    بتمسح المنطقة وسعرها للأبد. وده ضد قاعدة معمارية سارية: «لا حذف
 *    نهائي من واجهة الويب — الإيقاف بدل الحذف». والعمود `is_active`
 *    موجود أصلًا وشاشة الدفع بتفلتر بيه.
 *
 *    الطلبات القديمة محتفظة بسعرها في الطلب نفسه، فالإيقاف مابيغيّرش
 *    طلبًا قائمًا — زي الحذف بالظبط، من غير ما يضيع حاجة.
 */
export async function setShippingRateActive(id: string, isActive: boolean): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shipping_rates')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('Error toggling shipping rate', error);
    return fail('تعذّر تغيير حالة المنطقة');
  }
  // قاعدة «و»: صفر صفوف بلا خطأ = المنطقة مش موجودة أو الصلاحيات رفضت.
  if (!data || data.length === 0) {
    return fail('التغيير مروّحش للقاعدة — المنطقة مش موجودة أو الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: isActive ? 'shipping_rate_activated' : 'shipping_rate_deactivated',
    entityType: 'ShippingRate',
    entityId: id,
  });

  refreshShippingPages();
  return { ok: true };
}

/** Raising or lowering every area in one governorate at once. */
export async function adjustShippingRatesByGovernorate(
  countryCode: string,
  governorate: string,
  delta: number,
): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const country = countryCode.trim().toUpperCase();
  if (!COUNTRY_CODE.test(country)) return fail('الدولة غير صحيحة');
  if (!Number.isFinite(delta) || delta === 0) return fail('اكتب قيمة التعديل');

  const supabase = await createClient();
  const { data: rates, error: readError } = await supabase
    .from('shipping_rates')
    .select('id, fee')
    .eq('country_code', country)
    .eq('governorate', governorate);

  if (readError) {
    console.error('Error reading shipping rates for bulk adjust', readError);
    return fail('تعذّر قراءة المناطق');
  }
  if (!rates?.length) return fail('لا توجد مناطق في هذه المحافظة');

  // ⚠️ الحلقة دي كانت `await` **عارية**: مفيش فحص خطأ ولا عدد صفوف.
  //    فلو صف أو اتنين فشلوا، الإدارة بتشوف «تم» والأسعار **نصها
  //    اتغيّر ونصها لأ** — وده أسوأ من فشل كامل، لأن محدّش هيعرف
  //    أنهي منهم اتغيّر.
  let changed = 0;
  for (const rate of rates) {
    const next = Math.max(0, Number(rate.fee) + delta);
    const { data, error } = await supabase
      .from('shipping_rates')
      .update({ fee: next, updated_at: new Date().toISOString() })
      .eq('id', rate.id)
      .select('id');

    if (error) {
      console.error('Error adjusting shipping rate', error);
      return fail(
        `اتغيّرت ${changed} منطقة من ${rates.length}، وبعدين وقف. راجع الأسعار قبل ما تعيد.`,
      );
    }
    if (data && data.length > 0) changed += 1;
  }

  if (changed === 0) {
    return fail('ولا سعر اتغيّر — راجع الصلاحيات.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'shipping_rates_bulk_adjusted',
    entityType: 'ShippingRate',
    entityId: `${country}/${governorate}`,
    metadata: { countryCode: country, governorate, delta, areas: rates.length },
  });

  refreshShippingPages();
  return { ok: true, updated: rates.length };
}

/**
 * إيقاف التوصيل المادي كله مؤقتًا (إجازة، شركة الشحن واقفة…).
 * النسخة الإلكترونية بتفضل متاحة. المفتاح بيتقرا في القاعدة من `shipping_quote`.
 */
export async function setDeliveryPaused(params: {
  paused: boolean;
  message: string;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const message = params.message.trim();
  if (message.length > MAX_MESSAGE) return fail(`الرسالة أطول من ${MAX_MESSAGE} حرفًا`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      { key: 'delivery', value: { paused: params.paused, pausedMessage: message } },
      { onConflict: 'key' },
    )
    .select('key');
  if (error) {
    console.error('Error saving delivery pause', error);
    return fail('تعذّر حفظ إيقاف التوصيل');
  }
  if (!data || data.length === 0) {
    return fail('الحفظ مروّحش للقاعدة — الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: params.paused ? 'delivery_paused' : 'delivery_resumed',
    entityType: 'SiteSettings',
    entityId: 'delivery',
    metadata: { paused: params.paused, message },
  });

  refreshShippingPages();
  return { ok: true };
}

/**
 * فتح/إغلاق التوصيل المادي والنسخة الإلكترونية لدولة، ورسالة الإغلاق.
 *
 * ⚠️ مش بنسمح بفتح التوصيل المادي لدولة مالهاش محافظة فيها منطقة شغّالة:
 *    العميل هيشوف الدولة مفتوحة وماحدش يقدر يكمل.
 */
export async function updateCountry(params: {
  code: string;
  physicalEnabled: boolean;
  electronicEnabled: boolean;
  unavailableMessage: string;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const code = params.code.trim().toUpperCase();
  if (!COUNTRY_CODE.test(code)) return fail('الدولة غير صحيحة');
  const message = params.unavailableMessage.trim();
  if (message.length > MAX_MESSAGE) return fail(`الرسالة أطول من ${MAX_MESSAGE} حرفًا`);

  const supabase = await createClient();

  if (params.physicalEnabled) {
    const { count, error: countError } = await supabase
      .from('shipping_rates')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', code)
      .eq('is_active', true);
    if (countError) {
      console.error('Error counting shipping rates', countError);
      return fail('تعذّر التحقق من مناطق الدولة');
    }
    if (!count) {
      return fail('أضِف محافظة ومنطقة بسعرها أولًا قبل فتح التوصيل لهذه الدولة.');
    }
  }

  const { data, error } = await supabase
    .from('countries')
    .update({
      physical_enabled: params.physicalEnabled,
      electronic_enabled: params.electronicEnabled,
      unavailable_message: message || null,
      updated_at: new Date().toISOString(),
    })
    .eq('code', code)
    .select('code');
  if (error) {
    console.error('Error updating country', error);
    return fail('تعذّر حفظ إعدادات الدولة');
  }
  if (!data || data.length === 0) {
    return fail('الحفظ مروّحش للقاعدة — الدولة مش موجودة أو الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'delivery_country_updated',
    entityType: 'Country',
    entityId: code,
    metadata: {
      physicalEnabled: params.physicalEnabled,
      electronicEnabled: params.electronicEnabled,
      unavailableMessage: message,
    },
  });

  refreshShippingPages();
  return { ok: true };
}

/** إضافة محافظة لدولة (مصر متسجّلة بمحافظاتها؛ الدول الأخرى تُضاف عند فتحها). */
export async function addGovernorate(params: {
  countryCode: string;
  name: string;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const country = params.countryCode.trim().toUpperCase();
  const name = params.name.trim();
  if (!COUNTRY_CODE.test(country)) return fail('الدولة غير صحيحة');
  if (!name) return fail('اكتب اسم المحافظة');
  if (name.length > 80) return fail('اسم المحافظة طويل');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('governorates')
    .insert({ country_code: country, name_ar: name })
    .select('id');
  if (error) {
    console.error('Error adding governorate', error);
    if (error.code === '23505') return fail('المحافظة موجودة بالفعل في هذه الدولة.');
    if (error.code === '23503') return fail('الدولة غير موجودة.');
    return fail('تعذّر إضافة المحافظة');
  }
  if (!data || data.length === 0) {
    return fail('الإضافة مروّحتش للقاعدة — الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'governorate_created',
    entityType: 'Governorate',
    entityId: data[0].id,
    metadata: { countryCode: country, name },
  });

  refreshShippingPages();
  return { ok: true };
}

/** فتح/إغلاق توصيل محافظة كاملة (وإخفاؤها من القائمة). */
export async function setGovernorateFlags(params: {
  id: string;
  physicalEnabled: boolean;
  isActive: boolean;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('governorates')
    .update({
      physical_enabled: params.physicalEnabled,
      is_active: params.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id');
  if (error) {
    console.error('Error updating governorate', error);
    return fail('تعذّر تغيير حالة المحافظة');
  }
  if (!data || data.length === 0) {
    return fail('التغيير مروّحش للقاعدة — المحافظة مش موجودة أو الصلاحيات مش سامحة.');
  }

  await logAuditAction({
    actorProfileId: admin.id,
    actorName: admin.fullName,
    action: 'governorate_updated',
    entityType: 'Governorate',
    entityId: params.id,
    metadata: { physicalEnabled: params.physicalEnabled, isActive: params.isActive },
  });

  refreshShippingPages();
  return { ok: true };
}
