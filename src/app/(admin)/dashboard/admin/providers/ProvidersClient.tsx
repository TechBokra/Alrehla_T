'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2, Search } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import {
  saveProviderDetails,
  saveProviderOffering,
  removeProviderOffering,
  createIndividualProvider,
} from '@/actions/providers';
import type { ProviderWithOfferings, ProviderCandidate } from '@/data/domains/providers';
import type { ActionResult } from '@/actions/providers';
import { Field, TextInput, TextArea, Select, Checkbox, BusyButton, fieldClass } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

const UNEXPECTED = 'حصل عطل غير متوقع. راجع سجلات الخادم في Vercel.';

/** الخطأ الأخير ومكانه: `key` = الزرار اللي اتداس، و`field` = الخانة لو الخطأ عليها. */
type Failure = { key: string; error: string; field?: string };
type Run = (key: string, fn: () => Promise<ActionResult>) => void;

type CatalogService = { id: string; name: string; price: number };

const KIND_LABEL: Record<string, string> = {
  platform: 'المنصة',
  instructor: 'مدرب',
  individual: 'مقدّم مستقل',
};

const KIND_STYLE: Record<string, string> = {
  platform: 'bg-emerald-50 text-emerald-700',
  instructor: 'bg-sky-50 text-sky-700',
  individual: 'bg-violet-50 text-violet-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'معلّق',
  active: 'مفعّل',
  suspended: 'موقوف',
};

export function ProvidersClient({
  providers,
  services,
  platformMultiplier,
  fixedAdminFee,
  candidates,
}: {
  providers: ProviderWithOfferings[];
  services: CatalogService[];
  platformMultiplier: number | null;
  fixedAdminFee: number | null;
  candidates: ProviderCandidate[];
}) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // الزرار اللي شغّال دلوقتي — هو بس اللي بيكتب «جارٍ…»، والباقي بيتقفل.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(
    () =>
      providers.filter((p) => {
        if (kindFilter && p.kind !== kindFilter) return false;
        if (statusFilter && p.status !== statusFilter) return false;
        if (!query.trim()) return true;
        const q = query.trim();
        return (
          p.displayName.includes(q) || (p.email ?? '').toLowerCase().includes(q.toLowerCase())
        );
      }),
    [providers, kindFilter, statusFilter, query],
  );

  // الإجراءات بترجّع { ok, error } بدل ما ترمي، لأن Next بيخفي رسائل
  // الأخطاء المرمية في الإنتاج. الـcatch هنا للأعطال الحقيقية بس.
  const run: Run = async (key, fn) => {
    if (busyKey) return;
    setFailure(null);
    setBusyKey(key);
    try {
      const result = await fn();
      if (!result.ok) {
        setFailure({ key, error: result.error, field: result.field });
      }
    } catch {
      setFailure({ key, error: UNEXPECTED });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <AddProvider
        candidates={candidates}
        onSubmit={async (v) => {
          try {
            const result = await createIndividualProvider(v);
            if (!result.ok) return result;
            router.refresh();
            return { ok: true };
          } catch {
            return { ok: false, error: UNEXPECTED };
          }
        }}
      />

      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو البريد"
            aria-label="ابحث بالاسم أو البريد"
            className={`${fieldClass} pr-10`}
          />
        </div>
        {/* ⚠️ العرض على الغلاف مش على الخانة: `fieldClass` فيه `w-full`
            وبيغلب أي عرض تاني في Tailwind 4. */}
        <div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            aria-label="نوع المقدّم"
            className={fieldClass}
          >
            <option value="">كل الأنواع</option>
            <option value="platform">المنصة</option>
            <option value="instructor">مدرب</option>
            <option value="individual">مقدّم مستقل</option>
          </select>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="الحالة"
            className={fieldClass}
          >
            <option value="">كل الحالات</option>
            <option value="active">مفعّل</option>
            <option value="pending">معلّق</option>
            <option value="suspended">موقوف</option>
          </select>
        </div>
        <span className="text-sm font-bold text-slate-500">{filtered.length} مقدّم</span>
      </div>

      {filtered.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          services={services}
          platformMultiplier={platformMultiplier}
          fixedAdminFee={fixedAdminFee}
          open={openId === provider.id}
          onToggle={() => setOpenId(openId === provider.id ? null : provider.id)}
          busyKey={busyKey}
          failure={failure}
          run={run}
        />
      ))}

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">
          مفيش مقدّمي خدمة بالمواصفات دي.
        </p>
      )}
    </div>
  );
}

function AddProvider({
  onSubmit,
  candidates,
}: {
  candidates: ProviderCandidate[];
  /** بترجّع النتيجة. الفورم بيفضل مفتوح لو فشلت — عشان اللي كتبته
   *  ما يضيعش وإنت بتقرا سبب الرفض. */
  onSubmit: (v: {
    email: string;
    displayName: string;
    bio: string;
  }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: string; field?: string } | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" />
        إضافة مقدّم خدمة مستقل
      </button>
    );
  }

  // خطأ الخانة بيظهر تحتها، والباقي فوق النموذج.
  const fieldError = (field: string) => (failure?.field === field ? failure.error : undefined);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await onSubmit({ email, displayName, bio });
    setBusy(false);
    if (!result.ok) {
      setFailure({ error: result.error, field: result.field });
      return;
    }
    setEmail('');
    setDisplayName('');
    setBio('');
    setOpen(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-black text-slate-800">مقدّم خدمة مستقل</h3>
      <p className="text-sm font-medium text-slate-500">
        بيتربط بحساب موجود بالفعل. القايمة بتعرض الحسابات الصالحة بس — المدربون
        ومن هو مقدّم بالفعل مستبعدين. بيدخل «معلّق» لحد ما تفعّله.
      </p>

      {candidates.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          مفيش حساب صالح دلوقتي. كل الحسابات إما مدربين أو مقدّمين بالفعل. اطلب
          من الشخص يسجّل في الموقع، أو أضِفه من شاشة «المستخدمون والعائلات».
        </p>
      ) : (
        <>
          <FormError message={failure && !failure.field ? failure.error : ''} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="الحساب" required error={fieldError('email')}>
              <Select
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // الاسم بيتملّى من الحساب، وتقدر تغيّره — ده الاسم اللي
                  // العميل هيشوفه مش اسم الحساب بالضرورة.
                  const picked = candidates.find((c) => c.email === e.target.value);
                  if (picked && !displayName.trim()) setDisplayName(picked.fullName);
                }}
              >
                <option value="">اختر الحساب…</option>
                {candidates.map((c) => (
                  <option key={c.userId} value={c.email}>
                    {c.fullName ? `${c.fullName} — ${c.email}` : c.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الاسم المعروض للعميل" required error={fieldError('displayName')}>
              <TextInput
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="الاسم المعروض للعميل"
              />
            </Field>
          </div>
          <Field label="نبذة قصيرة تظهر في قايمة الاختيار" help="العميل بيشوفها وهو بيختار مين ينفّذ الخدمة — سطر واحد عن خبرته.">
            <TextArea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="نبذة قصيرة تظهر في قايمة الاختيار"
              rows={2}
            />
          </Field>
          <div className="flex gap-2">
            <BusyButton busy={busy} pendingLabel="جارٍ الإضافة…" onClick={submit}>
              إضافة
            </BusyButton>
            <BusyButton busy={false} variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              إلغاء
            </BusyButton>
          </div>
        </>
      )}

      {candidates.length === 0 && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-slate-200 px-5 py-2 font-bold text-slate-600"
        >
          إغلاق
        </button>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  services,
  platformMultiplier,
  fixedAdminFee,
  open,
  onToggle,
  busyKey,
  failure,
  run,
}: {
  provider: ProviderWithOfferings;
  services: CatalogService[];
  platformMultiplier: number | null;
  fixedAdminFee: number | null;
  open: boolean;
  onToggle: () => void;
  busyKey: string | null;
  failure: Failure | null;
  run: Run;
}) {
  const detailsKey = `details:${provider.id}`;
  const detailsFailure = failure?.key === detailsKey ? failure : null;
  const [name, setName] = useState(provider.displayName);
  const [bio, setBio] = useState(provider.bio);
  const [status, setStatus] = useState(provider.status);

  const isPlatform = provider.kind === 'platform';
  const approvedCount = provider.offerings.filter(
    (o) => o.status === 'approved' && o.isActive,
  ).length;

  /** اللي العميل هيدفعه فعلًا مقابل السعر المكتوب. */
  const customerPrice = (price: number) => {
    if (isPlatform) return price;
    if (platformMultiplier == null || fixedAdminFee == null) return price;
    return price * platformMultiplier + fixedAdminFee;
  };

  const missing = services.filter(
    (s) => !provider.offerings.some((o) => o.serviceId === s.id),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-4 p-6 text-right transition-colors hover:bg-slate-50"
      >
        <span className="flex-1 text-lg font-black text-slate-800">
          {provider.displayName}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${KIND_STYLE[provider.kind]}`}
        >
          {KIND_LABEL[provider.kind]}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            provider.status === 'active'
              ? 'bg-emerald-50 text-emerald-700'
              : provider.status === 'suspended'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {STATUS_LABEL[provider.status]}
        </span>
        <span className="text-sm font-bold text-slate-500">
          {approvedCount} خدمة معتمدة
        </span>
        {provider.email && (
          <span dir="ltr" className="text-xs font-medium text-slate-400">
            {provider.email}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-100 p-6">
          {/* البيانات */}
          <FormError message={detailsFailure && !detailsFailure.field ? detailsFailure.error : ''} />
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <Field
              label="الاسم المعروض"
              required
              error={detailsFailure?.field === 'displayName' ? detailsFailure.error : undefined}
            >
              <TextInput name="displayName" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="نبذة">
              <TextInput value={bio} onChange={(e) => setBio(e.target.value)} placeholder="نبذة" />
            </Field>
            <Field label="الحالة" help="مفعّل: بيظهر للعميل ويستقبل طلبات. معلّق أو موقوف: مابيظهرش للعميل ومابيستقبلش طلبات جديدة.">
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="active">مفعّل</option>
                <option value="pending">معلّق</option>
                <option value="suspended">موقوف</option>
              </Select>
            </Field>
            <BusyButton
              busy={busyKey === detailsKey}
              disabled={busyKey !== null}
              onClick={() =>
                run(detailsKey, () =>
                  saveProviderDetails({
                    providerId: provider.id,
                    displayName: name,
                    bio,
                    status,
                  }),
                )
              }
            >
              <Save className="h-4 w-4" />
              حفظ
            </BusyButton>
          </div>

          {/* شرح معنى السعر — الفرق ده سبب غلطة تسعير حقيقية قبل كده. */}
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            {isPlatform
              ? 'السعر هنا هو اللي العميل هيدفعه مباشرة — مفيش مستحق يتدفع لحد ومفيش معادلة فوقه.'
              : platformMultiplier != null && fixedAdminFee != null
                ? `السعر هنا هو مستحق مقدّم الخدمة. العميل بيدفع فوقه معادلة المنصة (×${platformMultiplier} + ${fixedAdminFee}) — والرقم النهائي مكتوب جنب كل خدمة.`
                : 'السعر هنا هو مستحق مقدّم الخدمة. معادلة المنصة مش متاحة دلوقتي، فالعميل بيتحاسب بنفس الرقم.'}
          </p>

          {/* العروض */}
          <div className="space-y-3">
            {provider.offerings.map((offering) => (
              <OfferingRow
                key={offering.id}
                providerId={provider.id}
                serviceId={offering.serviceId}
                serviceName={offering.serviceName}
                initialPrice={offering.approvedPrice}
                requestedPrice={offering.requestedPrice}
                initialStatus={offering.status}
                initialActive={offering.isActive}
                customerPrice={customerPrice}
                isPlatform={isPlatform}
                busyKey={busyKey}
                failure={failure}
                run={run}
              />
            ))}

            {missing.map((s) => (
              <OfferingRow
                key={s.id}
                providerId={provider.id}
                serviceId={s.id}
                serviceName={s.name}
                initialPrice={null}
                requestedPrice={null}
                initialStatus="pending"
                initialActive={true}
                customerPrice={customerPrice}
                isPlatform={isPlatform}
                isNew
                busyKey={busyKey}
                failure={failure}
                run={run}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferingRow({
  providerId,
  serviceId,
  serviceName,
  initialPrice,
  requestedPrice,
  initialStatus,
  initialActive,
  customerPrice,
  isPlatform,
  isNew,
  busyKey,
  failure,
  run,
}: {
  providerId: string;
  serviceId: string;
  serviceName: string;
  initialPrice: number | null;
  requestedPrice: number | null;
  initialStatus: 'pending' | 'approved' | 'rejected';
  initialActive: boolean;
  customerPrice: (p: number) => number;
  isPlatform: boolean;
  isNew?: boolean;
  busyKey: string | null;
  failure: Failure | null;
  run: Run;
}) {
  const saveKey = `save:${providerId}:${serviceId}`;
  const removeKey = `remove:${providerId}:${serviceId}`;
  // خطأ الصف ده بس — حفظه أو حذفه.
  const rowFailure = failure && (failure.key === saveKey || failure.key === removeKey) ? failure : null;
  const [price, setPrice] = useState(initialPrice?.toString() ?? '');
  const [status, setStatus] = useState(initialStatus);
  const [active, setActive] = useState(initialActive);

  const parsed = price.trim() === '' ? null : Number(price);
  const final = parsed != null && Number.isFinite(parsed) ? customerPrice(parsed) : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
        isNew ? 'border-dashed border-slate-200 bg-slate-50/50' : 'border-slate-200'
      }`}
    >
      <span className="min-w-[160px] flex-1 font-bold text-slate-700">{serviceName}</span>

      {requestedPrice != null && (
        <span className="text-xs font-bold text-slate-400">
          طلب {formatPrice(requestedPrice)}
        </span>
      )}

      {/* العرض على الغلاف — `fieldClass` فيه `w-full`. */}
      <div className="w-28">
        <TextInput
          name="approvedPrice"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="السعر"
          aria-label={`سعر ${serviceName}`}
          aria-invalid={rowFailure?.field === 'approvedPrice' || undefined}
        />
      </div>

      {/* الرقم اللي العميل هيشوفه — عشان محدش يعتمد سعر وهو فاكره حاجة تانية */}
      {!isPlatform && final != null && (
        <span className="text-xs font-bold text-emerald-700">
          العميل: {formatPrice(Math.round(final))}
        </span>
      )}

      <div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          aria-label={`حالة ${serviceName}`}
        >
          <option value="pending">معلّق</option>
          <option value="approved">معتمد</option>
          <option value="rejected">مرفوض</option>
        </Select>
      </div>

      <Checkbox label="ظاهر" checked={active} onChange={(e) => setActive(e.target.checked)} />

      <BusyButton
        busy={busyKey === saveKey}
        disabled={busyKey !== null}
        onClick={() =>
          run(saveKey, () =>
            saveProviderOffering({
              providerId,
              serviceId,
              approvedPrice: parsed,
              status,
              isActive: active,
            }),
          )
        }
      >
        حفظ
      </BusyButton>

      {!isNew && (
        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() => run(removeKey, () => removeProviderOffering(providerId, serviceId))}
          className="rounded-lg border border-red-200 px-3 py-2 text-red-600 disabled:opacity-50"
          aria-label="حذف العرض"
          aria-busy={busyKey === removeKey || undefined}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {rowFailure && (
        <p role="alert" className="w-full text-xs font-bold text-red-600">
          {rowFailure.error}
        </p>
      )}
    </div>
  );
}
