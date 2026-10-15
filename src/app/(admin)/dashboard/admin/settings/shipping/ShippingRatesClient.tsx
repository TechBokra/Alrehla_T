'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Check, X, Search, TrendingUp, TriangleAlert } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { AdminDeliveryConfig } from '@/data/domains/(admin)/shipping/queries';
import type { Country, Governorate, ShippingRateRow } from '@/data/domains/(shared)/shipping/types';
import {
  addGovernorate,
  adjustShippingRatesByGovernorate,
  setDeliveryPaused,
  setGovernorateFlags,
  setShippingRateActive,
  updateCountry,
  upsertShippingRate,
  type ShippingResult,
} from '@/actions/shipping';
import { COUNTRY_CLOSED_MESSAGE } from '@/lib/delivery';
import { Field, TextInput, Select, Checkbox, BusyButton, fieldClass } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

/**
 * تشغيل أكشن من الشاشة: «جارٍ…» على الزر اللي اتداس بس، والخطأ يظهر
 * جنب الجزء اللي اتغيّر.
 *
 * ⚠️ الأكشنز بترجّع `{ ok:false, error }` ولا بترمي (قاعدة «هـ») — فلازم
 *    النتيجة تتقري، وإلا الرفض يعدّي كأنه نجاح.
 */
function useAction() {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (key: string, fn: () => Promise<ShippingResult>, onDone?: () => void) => {
    setBusyKey(key);
    setError('');
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error || 'تعذّر الحفظ');
        return false;
      }
      onDone?.();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  return { run, busyKey, busy: busyKey !== null, error, setError };
}

export function ShippingRatesClient({ config }: { config: AdminDeliveryConfig }) {
  const estimates = config.rates.filter((r) => r.isEstimate).length;

  return (
    <div className="space-y-10">
      {estimates > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            {estimates.toLocaleString('ar-EG')} منطقة بسعر <span className="underline">تقديري</span> لم يُراجَع مع
            شركة الشحن. راجِعها وعدّل السعر (ثم أزل علامة «تقديري») قبل الإطلاق.
          </p>
        </div>
      )}

      <PauseCard pause={config.pause} />
      <CountriesCard countries={config.countries} />
      <AreasSection config={config} />
    </div>
  );
}

/* ───────────── إيقاف التوصيل العام ───────────── */

function PauseCard({ pause }: { pause: AdminDeliveryConfig['pause'] }) {
  const { run, busyKey, busy, error } = useAction();
  const [paused, setPaused] = useState(pause.paused);
  const [message, setMessage] = useState(pause.message);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
      <header>
        <h2 className="text-lg font-black text-slate-800">إيقاف التوصيل مؤقتًا</h2>
        <p className="text-sm font-medium text-slate-500">
          يوقف طلب المنتجات المطبوعة والإضافات والصندوق في كل الدول. النسخة الإلكترونية تبقى متاحة.
        </p>
      </header>
      <FormError message={error} />
      <Checkbox
        label="التوصيل متوقف حاليًا"
        hint="العميل يرى الرسالة أدناه في صفحة الدفع، ولا يستطيع تسجيل طلب يحتاج شحنًا."
        checked={paused}
        onChange={(e) => setPaused(e.target.checked)}
      />
      <Field label="رسالة للعميل (اختيارية)" hint="لو تُركت فارغة: «التوصيل متوقف مؤقتًا — يمكنك طلب النسخة الإلكترونية».">
        <TextInput maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <BusyButton
          busy={busyKey === 'pause'}
          disabled={busy || (paused === pause.paused && message === pause.message)}
          onClick={() => run('pause', () => setDeliveryPaused({ paused, message }))}
        >
          <Check className="h-4 w-4" /> حفظ
        </BusyButton>
      </div>
    </section>
  );
}

/* ───────────── الدول ───────────── */

function CountriesCard({ countries }: { countries: Country[] }) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
      <header>
        <h2 className="text-lg font-black text-slate-800">الدول</h2>
        <p className="text-sm font-medium text-slate-500">
          لكل دولة: هل يُوصَّل لها المطبوع، وهل تُباع لها النسخة الإلكترونية. الدولة المغلقة تظهر للعميل
          بالرسالة المكتوبة لها. مصر هي الافتراضية.
        </p>
      </header>
      <div className="space-y-2">
        {countries.map((c) => (
          <CountryRow key={`${c.code}:${c.physicalEnabled}:${c.electronicEnabled}:${c.unavailableMessage ?? ''}`} country={c} />
        ))}
      </div>
    </section>
  );
}

function CountryRow({ country }: { country: Country }) {
  const { run, busyKey, busy, error } = useAction();
  const [physical, setPhysical] = useState(country.physicalEnabled);
  const [electronic, setElectronic] = useState(country.electronicEnabled);
  const [message, setMessage] = useState(country.unavailableMessage ?? '');
  const dirty =
    physical !== country.physicalEnabled ||
    electronic !== country.electronicEnabled ||
    message.trim() !== (country.unavailableMessage ?? '');

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-[8rem] font-bold text-slate-800">
          {country.nameAr}
          {country.isDefault && (
            <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">افتراضية</span>
          )}
        </div>
        <Checkbox label="توصيل المطبوع" checked={physical} onChange={(e) => setPhysical(e.target.checked)} />
        <Checkbox label="النسخة الإلكترونية" checked={electronic} onChange={(e) => setElectronic(e.target.checked)} />
        <BusyButton
          busy={busyKey === 'country'}
          disabled={busy || !dirty}
          className="mr-auto !min-h-[40px] !px-4 !py-2 text-sm"
          onClick={() =>
            run('country', () =>
              updateCountry({
                code: country.code,
                physicalEnabled: physical,
                electronicEnabled: electronic,
                unavailableMessage: message,
              }),
            )
          }
        >
          حفظ
        </BusyButton>
      </div>
      {!physical && (
        <Field label="رسالة الإغلاق للعميل" hint={`لو تُركت فارغة: «${COUNTRY_CLOSED_MESSAGE}».`}>
          <TextInput maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      )}
    </div>
  );
}

/* ───────────── المحافظات والمناطق ───────────── */

type Draft = {
  id?: string;
  governorate: string;
  city: string;
  fee: string;
  isActive: boolean;
  isEstimate: boolean;
  /** السعر المحفوظ قبل التعديل — بنقارن بيه عشان نشيل «تقديري» لوحدها. */
  savedFee?: number;
};

function AreasSection({ config }: { config: AdminDeliveryConfig }) {
  const { run, busyKey, busy, error, setError } = useAction();
  const defaultCode = config.countries.find((c) => c.isDefault)?.code ?? config.countries[0]?.code ?? 'EG';
  const [countryCode, setCountryCode] = useState(defaultCode);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulkGov, setBulkGov] = useState<string | null>(null);
  const [bulkDelta, setBulkDelta] = useState('');
  const [newGov, setNewGov] = useState('');

  const governorates = useMemo(
    () => config.governorates.filter((g) => g.countryCode === countryCode),
    [config.governorates, countryCode],
  );
  const ratesByGov = useMemo(() => {
    const term = query.trim();
    const map = new Map<string, ShippingRateRow[]>();
    for (const r of config.rates) {
      if (r.countryCode !== countryCode) continue;
      if (term && !r.governorate.includes(term) && !r.city.includes(term)) continue;
      const list = map.get(r.governorate) ?? [];
      list.push(r);
      map.set(r.governorate, list);
    }
    return map;
  }, [config.rates, countryCode, query]);

  const visibleGovernorates = governorates.filter((g) => {
    const term = query.trim();
    return !term || g.nameAr.includes(term) || (ratesByGov.get(g.nameAr)?.length ?? 0) > 0;
  });

  const save = (value: Draft) =>
    run(
      'form',
      () =>
        upsertShippingRate({
          id: value.id,
          countryCode,
          governorate: value.governorate,
          city: value.city,
          fee: Number(value.fee),
          isActive: value.isActive,
          isEstimate: value.isEstimate,
        }),
      () => setDraft(null),
    );

  const emptyDraft = (governorate: string): Draft => ({
    governorate,
    city: '',
    fee: '',
    isActive: true,
    isEstimate: false,
  });

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <h2 className="text-lg font-black text-slate-800">المحافظات والمناطق</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="الدولة" className="min-w-[200px]">
            <Select
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setDraft(null);
                setBulkGov(null);
                setError('');
              }}
            >
              {config.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameAr}
                  {c.physicalEnabled ? '' : ' (مغلقة)'}
                </option>
              ))}
            </Select>
          </Field>
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="ابحث بالمحافظة أو المنطقة"
              className={`${fieldClass} pr-9`}
              placeholder="ابحث بالمحافظة أو المنطقة…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <FormError message={draft ? '' : error} />

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <Field label="إضافة محافظة لهذه الدولة" className="min-w-[220px] flex-1">
          <TextInput value={newGov} maxLength={80} onChange={(e) => setNewGov(e.target.value)} placeholder="اسم المحافظة / المنطقة الكبرى" />
        </Field>
        <BusyButton
          busy={busyKey === 'gov-add'}
          disabled={busy || !newGov.trim()}
          onClick={() => run('gov-add', () => addGovernorate({ countryCode, name: newGov }), () => setNewGov(''))}
        >
          <Plus className="h-4 w-4" /> إضافة
        </BusyButton>
      </div>

      {visibleGovernorates.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          لا توجد محافظات مطابقة. أضِف محافظة ثم مناطقها وأسعارها لتتمكن من فتح التوصيل لهذه الدولة.
        </p>
      )}

      {visibleGovernorates.map((gov) => {
        const areas = ratesByGov.get(gov.nameAr) ?? [];
        return (
          <GovernorateCard
            key={gov.id}
            gov={gov}
            areas={areas}
            draft={draft}
            setDraft={setDraft}
            bulkOpen={bulkGov === gov.nameAr}
            toggleBulk={() => {
              setBulkGov(bulkGov === gov.nameAr ? null : gov.nameAr);
              setError('');
            }}
            bulkDelta={bulkDelta}
            setBulkDelta={setBulkDelta}
            busy={busy}
            busyKey={busyKey}
            error={error}
            clearError={() => setError('')}
            newDraft={() => {
              setDraft(emptyDraft(gov.nameAr));
              setError('');
            }}
            save={save}
            onToggleGov={() =>
              run(`gov-${gov.id}`, () =>
                setGovernorateFlags({ id: gov.id, physicalEnabled: !gov.physicalEnabled, isActive: gov.isActive }),
              )
            }
            onToggleArea={(rate) => run(`area-${rate.id}`, () => setShippingRateActive(rate.id, !rate.isActive))}
            onBulk={() =>
              run(
                `bulk-${gov.id}`,
                () => adjustShippingRatesByGovernorate(countryCode, gov.nameAr, Number(bulkDelta)),
                () => {
                  setBulkGov(null);
                  setBulkDelta('');
                },
              )
            }
          />
        );
      })}
    </section>
  );
}

function GovernorateCard(props: {
  gov: Governorate;
  areas: ShippingRateRow[];
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  bulkOpen: boolean;
  toggleBulk: () => void;
  bulkDelta: string;
  setBulkDelta: (v: string) => void;
  busy: boolean;
  busyKey: string | null;
  error: string;
  clearError: () => void;
  newDraft: () => void;
  save: (d: Draft) => Promise<boolean>;
  onToggleGov: () => void;
  onToggleArea: (rate: ShippingRateRow) => void;
  onBulk: () => void;
}) {
  const { gov, areas, draft, setDraft, busy, busyKey, error } = props;

  return (
    <div className={`rounded-3xl border bg-white p-5 ${gov.physicalEnabled ? 'border-slate-200' : 'border-amber-300'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-lg font-black text-slate-800">
            {gov.nameAr}
            {!gov.physicalEnabled && (
              <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                التوصيل مغلق
              </span>
            )}
          </h3>
          <p className="text-xs font-bold text-slate-400">
            {areas.length === 0
              ? 'لا توجد مناطق'
              : `${areas.length.toLocaleString('ar-EG')} منطقة · من ${formatPrice(Math.min(...areas.map((a) => a.fee)))} إلى ${formatPrice(Math.max(...areas.map((a) => a.fee)))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.newDraft}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600"
          >
            <Plus className="h-3.5 w-3.5" /> منطقة
          </button>
          <button
            type="button"
            onClick={props.toggleBulk}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <TrendingUp className="h-3.5 w-3.5" /> تعديل كل المحافظة
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={props.onToggleGov}
            className={`rounded-xl border bg-white px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
              gov.physicalEnabled
                ? 'border-red-200 text-red-700 hover:bg-red-50'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {busyKey === `gov-${gov.id}` ? 'جارٍ…' : gov.physicalEnabled ? 'إغلاق التوصيل' : 'فتح التوصيل'}
          </button>
        </div>
      </div>

      {props.bulkOpen && (
        <div className="mb-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <FormError message={error} />
          <div className="flex flex-wrap items-start gap-2">
            <Field
              label={`زيادة أو خصم على كل مناطق ${gov.nameAr} (ج.م)`}
              hint="اكتب رقمًا سالبًا للخصم."
              className="min-w-[200px] flex-1"
            >
              <TextInput
                type="number"
                value={props.bulkDelta}
                onChange={(e) => props.setBulkDelta(e.target.value)}
                placeholder="مثال: 10 أو -5"
              />
            </Field>
            <BusyButton
              busy={busyKey === `bulk-${gov.id}`}
              pendingLabel="جارٍ التطبيق…"
              disabled={busy || !props.bulkDelta}
              onClick={props.onBulk}
              className="mt-7 shrink-0"
            >
              تطبيق
            </BusyButton>
          </div>
        </div>
      )}

      {draft && !draft.id && draft.governorate === gov.nameAr && (
        <div className="mb-3">
          <RateForm
            value={draft}
            onChange={setDraft}
            onCancel={() => {
              setDraft(null);
              props.clearError();
            }}
            onSave={() => props.save(draft)}
            busy={busy}
            saving={busyKey === 'form'}
            error={error}
            governorates={[gov]}
          />
        </div>
      )}

      <div className="space-y-2">
        {areas.map((rate) =>
          draft?.id === rate.id ? (
            <RateForm
              key={rate.id}
              value={draft}
              onChange={setDraft}
              onCancel={() => {
                setDraft(null);
                props.clearError();
              }}
              onSave={() => props.save(draft)}
              busy={busy}
              saving={busyKey === 'form'}
              error={error}
              governorates={[gov]}
            />
          ) : (
            <div
              key={rate.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 ${
                rate.isActive ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white opacity-60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800">{rate.city}</span>
                {!rate.isActive && (
                  <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">موقوفة</span>
                )}
                {rate.isEstimate && (
                  <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">تقديري</span>
                )}
              </div>
              <span className="font-black text-slate-800">{formatPrice(rate.fee)}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft({
                      id: rate.id,
                      governorate: rate.governorate,
                      city: rate.city,
                      fee: String(rate.fee),
                      isActive: rate.isActive,
                      isEstimate: rate.isEstimate,
                      savedFee: rate.fee,
                    });
                    props.clearError();
                  }}
                  aria-label={`تعديل ${rate.city}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {/* ⚠️ كان «حذف نهائي» بسلة مهملات ومن غير تأكيد. بقى
                    إيقاف/تشغيل — ضغطة غلط بتترجع بضغطة. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => props.onToggleArea(rate)}
                  aria-label={rate.isActive ? `إيقاف ${rate.city}` : `تشغيل ${rate.city}`}
                  className={`rounded-xl border bg-white px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                    rate.isActive
                      ? 'border-red-200 text-red-700 hover:bg-red-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {rate.isActive ? 'إيقاف' : 'تشغيل'}
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function RateForm({
  value,
  onChange,
  onCancel,
  onSave,
  busy,
  saving,
  error,
  governorates,
}: {
  value: Draft;
  onChange: (v: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  saving: boolean;
  error: string;
  governorates: Governorate[];
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <FormError message={error} />
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="المحافظة" required>
          <Select
            value={value.governorate}
            onChange={(e) => onChange({ ...value, governorate: e.target.value })}
          >
            {governorates.map((g) => (
              <option key={g.id} value={g.nameAr}>
                {g.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المنطقة / المدينة" help="الاسم اللي العميل بيختاره من القايمة في صفحة الدفع. أي منطقة مش مضافة هنا مش هتظهر له." required>
          <TextInput value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </Field>
        <Field
          label="السعر (ج.م)"
          required
          hint={
            value.savedFee !== undefined && value.isEstimate
              ? 'تغيير السعر بيشيل علامة «تقديري» تلقائيًا.'
              : undefined
          }
        >
          <TextInput
            type="number"
            min={0}
            value={value.fee}
            onChange={(e) => {
              const fee = e.target.value;
              // ⚠️ السعر اللي الأدمن كتبه بإيده = سعر مراجَع، فعلامة «تقديري»
              //    بتتشال لوحدها. كانت بتفضل متعلّمة بعد التعديل، فالقايمة
              //    تقول «محتاج مراجعة» على أسعار اتراجعت فعلًا.
              const changed = value.savedFee !== undefined && Number(fee) !== value.savedFee;
              onChange({ ...value, fee, ...(changed ? { isEstimate: false } : {}) });
            }}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Checkbox
          label="مفعّلة"
          hint="تظهر للعملاء في شاشة الدفع. الإيقاف يغلق التوصيل لهذه المنطقة فقط."
          checked={value.isActive}
          onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
        />
        <Checkbox
          label="سعر تقديري"
          hint="علامة «محتاج مراجعة مع شركة الشحن». بتتشال لوحدها أول ما تغيّر السعر."
          checked={value.isEstimate}
          onChange={(e) => onChange({ ...value, isEstimate: e.target.checked })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <BusyButton busy={false} variant="secondary" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" /> إلغاء
        </BusyButton>
        <BusyButton busy={saving} disabled={busy} onClick={onSave}>
          <Check className="h-4 w-4" /> حفظ
        </BusyButton>
      </div>
    </div>
  );
}
