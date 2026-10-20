import { createClient } from '@/lib/supabase/server';
import type {
  Country,
  DeliveryCatalog,
  DeliveryPause,
  Governorate,
  ShippingRate,
} from '@/data/domains/(shared)/shipping/types';

/**
 * كل ما تحتاجه شاشة الدفع: الدول ← المحافظات ← المناطق (بسعرها) + إيقاف
 * التوصيل العام.
 *
 * Checkout used to charge a flat 50 EGP with the comment "Fixed shipping logic
 * for demo". Shipping is not flat, so the number comes from the rates the
 * admin sets — and when nothing is configured the customer is told the fee
 * will be confirmed rather than shown an invented one.
 *
 * ⚠️ للعرض فقط: القاعدة (`shipping_quote`) هي اللي بتقرر وقت تسجيل الطلب.
 *    ولو القراءة فشلت بنرجّع كتالوج فاضي من غير دول، فالشاشة بتقول
 *    «الدول غير متاحة» ومابتخترعش مصر مفتوحة.
 */
export const EMPTY_DELIVERY_CATALOG: DeliveryCatalog = {
  countries: [],
  governorates: [],
  rates: [],
  pause: { paused: false, message: '' },
};

function parsePause(value: unknown): DeliveryPause {
  const v = (value ?? {}) as { paused?: unknown; pausedMessage?: unknown };
  return {
    paused: v.paused === true,
    message: typeof v.pausedMessage === 'string' ? v.pausedMessage : '',
  };
}

export async function getDeliveryCatalog(): Promise<DeliveryCatalog> {
  const supabase = await createClient();

  const [countriesRes, governoratesRes, ratesRes, pauseRes] = await Promise.all([
    supabase
      .from('countries')
      .select(
        'code, name_ar, dial_code, is_default, is_listed, physical_enabled, electronic_enabled, unavailable_message, sort_order',
      )
      .eq('is_listed', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('governorates')
      .select('id, country_code, name_ar, physical_enabled, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('shipping_rates')
      .select('country_code, governorate, city, fee')
      .eq('is_active', true)
      .order('governorate', { ascending: true })
      .order('city', { ascending: true }),
    supabase.from('site_settings').select('value').eq('key', 'delivery').maybeSingle(),
  ]);

  if (countriesRes.error || governoratesRes.error || ratesRes.error) {
    console.error('Error loading delivery catalog', {
      countries: countriesRes.error,
      governorates: governoratesRes.error,
      rates: ratesRes.error,
    });
    return EMPTY_DELIVERY_CATALOG;
  }

  const countries: Country[] = (countriesRes.data ?? []).map((c) => ({
    code: c.code,
    nameAr: c.name_ar,
    dialCode: c.dial_code,
    isDefault: c.is_default,
    isListed: c.is_listed,
    physicalEnabled: c.physical_enabled,
    electronicEnabled: c.electronic_enabled,
    unavailableMessage: c.unavailable_message,
    sortOrder: c.sort_order,
  }));

  const governorates: Governorate[] = (governoratesRes.data ?? []).map((g) => ({
    id: g.id,
    countryCode: g.country_code,
    nameAr: g.name_ar,
    physicalEnabled: g.physical_enabled,
    isActive: g.is_active,
    sortOrder: g.sort_order,
  }));

  const rates: ShippingRate[] = (ratesRes.data ?? [])
    .filter((r) => Boolean(r.city))
    .map((r) => ({
      countryCode: r.country_code,
      governorate: r.governorate,
      city: r.city as string,
      fee: Number(r.fee),
    }));

  return {
    countries,
    governorates,
    rates,
    pause: parsePause(pauseRes.data?.value),
  };
}
