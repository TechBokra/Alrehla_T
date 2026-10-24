'use client';

import React from 'react';
import { MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { DeliveryCatalog } from '@/data/domains/(shared)/shipping/types';
import { areasOf, defaultCountryCode, governoratesOf, physicalVerdict, type DeliveryVerdict } from '@/lib/delivery';
import { loadDeliveryRegion, saveDeliveryRegion, type DeliveryRegion } from '@/lib/delivery-region-store';
import { formatPrice } from '@/lib/utils';
import { Field, Select } from '@/components/forms/Form';

/**
 * «هنوصّل فين؟» — جوّه المعالج، **قبل** الإضافات والدفع.
 *
 * قرار تامر (٢٤ أكتوبر): لو مفيش توصيل لمنطقة العميل، يتعرض عليه
 * الإلكتروني بس — من أول المعالج، مش في آخر خطوة دفع.
 *
 * ⚠️ نفس قواعد صفحة الدفع بالظبط (`physicalVerdict` من `lib/delivery`)،
 *    والاختيار بيتحفظ والدفع بيبدأ بيه. القاعدة هي الحارس في الآخر.
 */
export function useDeliveryRegion(catalog: DeliveryCatalog | undefined) {
  const [region, setRegion] = React.useState<DeliveryRegion>(() => ({
    country: catalog ? defaultCountryCode(catalog.countries) : 'EG',
    gov: '',
    city: '',
  }));

  // المنطقة اللي اتختارت قبل كده (من نفس الجهاز) — لو لسه موجودة في الكتالوج.
  React.useEffect(() => {
    if (!catalog) return;
    const saved = loadDeliveryRegion();
    if (!saved) return;
    const exists = catalog.rates.some(
      (r) => r.countryCode === saved.country && r.governorate === saved.gov && r.city === saved.city,
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- التخزين في المتصفح بس؛ القراية بعد أول رسم.
    if (exists) setRegion(saved);
  }, [catalog]);

  const update = React.useCallback((next: DeliveryRegion) => {
    setRegion(next);
    if (next.city) saveDeliveryRegion(next);
  }, []);

  const verdict: DeliveryVerdict | null = catalog
    ? physicalVerdict(catalog, { country: region.country, governorate: region.gov, city: region.city })
    : null;
  // «لسه ما اختارش» غير «اختار ومقفول».
  const chosen = Boolean(region.city) || (verdict !== null && !verdict.available && verdict.reason !== 'area_closed');

  return { region, update, verdict, chosen };
}

export function DeliveryRegionPicker({
  catalog,
  region,
  onChange,
  verdict,
  chosen,
  error,
}: {
  catalog: DeliveryCatalog;
  region: DeliveryRegion;
  onChange: (next: DeliveryRegion) => void;
  verdict: DeliveryVerdict | null;
  chosen: boolean;
  error?: string;
}) {
  const countries = catalog.countries.filter((c) => c.isListed);
  const govs = governoratesOf(catalog, region.country);
  const areas = areasOf(catalog, region.country, region.gov);

  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <legend className="flex items-center gap-2 px-2 font-bold text-slate-800">
        <MapPin className="h-4 w-4" aria-hidden="true" /> هنوصّل فين؟
      </legend>
      <p className="mb-4 text-sm text-slate-600">
        عشان نعرض لك اللي بيوصل لمنطقتك بس. العنوان بالتفصيل بتكتبه في الدفع.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {countries.length > 1 && (
          <Field label="الدولة">
            <Select
              value={region.country}
              onChange={(e) => onChange({ country: e.target.value, gov: '', city: '' })}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameAr}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="المحافظة">
          <Select value={region.gov} onChange={(e) => onChange({ ...region, gov: e.target.value, city: '' })}>
            <option value="">اختار…</option>
            {govs.map((g) => (
              <option key={g.id} value={g.nameAr}>
                {g.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المنطقة" error={error}>
          <Select
            value={region.city}
            disabled={!region.gov}
            onChange={(e) => onChange({ ...region, city: e.target.value })}
          >
            <option value="">{region.gov ? 'اختار…' : 'اختار المحافظة الأول'}</option>
            {areas.map((a) => (
              <option key={a.city} value={a.city}>
                {a.city} — شحن {formatPrice(a.fee)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {chosen && verdict && (
        verdict.available ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            بنوصّل لمنطقتك — الشحن {formatPrice(verdict.fee)}
          </p>
        ) : (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {verdict.message}
          </p>
        )
      )}
    </fieldset>
  );
}
