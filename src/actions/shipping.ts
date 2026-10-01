'use server';
import { requireAdmin } from '@/lib/auth-guard';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';

/**
 * Shipping fees by area, managed from the admin dashboard.
 *
 * Checkout used to charge a flat 50 EGP written into the code. The fee now
 * comes from this table, which means it has to be editable somewhere other
 * than the database console.
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

function validate(
  governorate: string,
  city: string,
  fee: number,
): { ok: true; gov: string; area: string } | { ok: false; error: string } {
  const gov = governorate.trim();
  const area = city.trim();
  if (!gov) return { ok: false, error: 'اكتب اسم المحافظة' };
  if (!area) return { ok: false, error: 'اكتب اسم المنطقة' };
  if (!Number.isFinite(fee) || fee < 0) return { ok: false, error: 'السعر غير صحيح' };
  if (fee > 100000) return { ok: false, error: 'السعر غير منطقي' };
  return { ok: true, gov, area };
}

export async function upsertShippingRate(params: {
  id?: string;
  governorate: string;
  city: string;
  fee: number;
  isActive: boolean;
}): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  const checked = validate(params.governorate, params.city, params.fee);
  if (!checked.ok) return fail(checked.error);
  const { gov, area } = checked;
  const supabase = await createClient();

  const row = {
    governorate: gov,
    city: area,
    fee: params.fee,
    is_active: params.isActive,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = params.id
    ? await supabase.from('shipping_rates').update(row).eq('id', params.id).select('id')
    : await supabase
        .from('shipping_rates')
        .upsert(row, { onConflict: 'governorate,city' })
        .select('id');

  if (error) {
    console.error('Error saving shipping rate', error);
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
    entityId: params.id ?? `${gov}/${area}`,
    metadata: { governorate: gov, city: area, fee: params.fee, isActive: params.isActive },
  });

  revalidatePath('/dashboard/admin/settings/shipping');
  revalidatePath('/enha-lak/checkout');
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

  revalidatePath('/dashboard/admin/settings/shipping');
  revalidatePath('/enha-lak/checkout');
  return { ok: true };
}

/** Raising or lowering every area in one governorate at once. */
export async function adjustShippingRatesByGovernorate(
  governorate: string,
  delta: number,
): Promise<ShippingResult> {
  const admin = await requireOrdersAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أسعار الشحن');
  if (!Number.isFinite(delta) || delta === 0) return fail('اكتب قيمة التعديل');

  const supabase = await createClient();
  const { data: rates } = await supabase
    .from('shipping_rates')
    .select('id, fee')
    .eq('governorate', governorate);

  if (!rates?.length) return fail('لا توجد مناطق في هذه المحافظة');

  // ⚠️ الحلقة دي كانت `await` **عارية**: مفيش فحص خطأ ولا عدد صفوف.
  //    فلو صف أو اتنين فشلوا، الإدارة بتشوف «تم» والأسعار **نصها
  //    اتغيّر ونصها لأ** — وده أسوأ من فشل كامل، لأن محدّش هيعرف
  //    أنهي منهم اتغيّر.
  let changed = 0;
  for (const rate of rates) {
    const next = Math.max(0, rate.fee + delta);
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
    entityId: governorate,
    metadata: { governorate, delta, areas: rates.length },
  });

  revalidatePath('/dashboard/admin/settings/shipping');
  revalidatePath('/enha-lak/checkout');
  return { ok: true, updated: rates.length };
}
