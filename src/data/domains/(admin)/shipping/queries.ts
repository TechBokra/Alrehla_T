import { createClient } from '@/lib/supabase/server';
import type {
  Country,
  DeliveryPause,
  Governorate,
  ShippingRateRow,
} from '@/data/domains/(shared)/shipping/types';

/** كل الدول والمحافظات والمناطق (حتى الموقوفة) + الإيقاف العام — لشاشة الأدمن. */
export type AdminDeliveryConfig = {
  countries: Country[];
  governorates: Governorate[];
  rates: ShippingRateRow[];
  pause: DeliveryPause;
};

export type AdminDeliveryResult =
  | { ok: true; config: AdminDeliveryConfig }
  | { ok: false; error: string };

/**
 * ⚠️ فشل القراءة **بيرجّع خطأ** مش قايمة فاضية (قاعدة الأدمن الصارمة): قايمة
 *    مناطق فاضية كانت بتقول للإدارة «مفيش شحن متسجّل» وهي بس ماقدرتش تقرا.
 */
export async function getAdminDeliveryConfig(): Promise<AdminDeliveryResult> {
  const supabase = await createClient();

  const [countriesRes, governoratesRes, ratesRes, pauseRes] = await Promise.all([
    supabase
      .from('countries')
      .select(
        'code, name_ar, dial_code, is_default, is_listed, physical_enabled, electronic_enabled, unavailable_message, sort_order',
      )
      .order('sort_order', { ascending: true }),
    supabase
      .from('governorates')
      .select('id, country_code, name_ar, physical_enabled, is_active, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('shipping_rates')
      .select('id, country_code, governorate, city, fee, is_active, is_estimate')
      .order('governorate', { ascending: true })
      .order('city', { ascending: true }),
    supabase.from('site_settings').select('value').eq('key', 'delivery').maybeSingle(),
  ]);

  const failed = countriesRes.error ?? governoratesRes.error ?? ratesRes.error ?? pauseRes.error;
  if (failed) {
    console.error('Error loading admin delivery config', failed);
    return { ok: false, error: 'تعذّر تحميل إعدادات التوصيل. حدّث الصفحة وحاول مرة أخرى.' };
  }

  const pauseValue = (pauseRes.data?.value ?? {}) as { paused?: unknown; pausedMessage?: unknown };

  return {
    ok: true,
    config: {
      countries: (countriesRes.data ?? []).map((c) => ({
        code: c.code,
        nameAr: c.name_ar,
        dialCode: c.dial_code,
        isDefault: c.is_default,
        isListed: c.is_listed,
        physicalEnabled: c.physical_enabled,
        electronicEnabled: c.electronic_enabled,
        unavailableMessage: c.unavailable_message,
        sortOrder: c.sort_order,
      })),
      governorates: (governoratesRes.data ?? []).map((g) => ({
        id: g.id,
        countryCode: g.country_code,
        nameAr: g.name_ar,
        physicalEnabled: g.physical_enabled,
        isActive: g.is_active,
        sortOrder: g.sort_order,
      })),
      rates: (ratesRes.data ?? []).map((r) => ({
        id: r.id,
        countryCode: r.country_code,
        governorate: r.governorate,
        city: r.city ?? '',
        fee: Number(r.fee),
        isActive: r.is_active,
        isEstimate: r.is_estimate,
      })),
      pause: {
        paused: pauseValue.paused === true,
        message: typeof pauseValue.pausedMessage === 'string' ? pauseValue.pausedMessage : '',
      },
    },
  };
}
