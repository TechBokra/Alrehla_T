'use client';
import { useState } from 'react';
import { Plus, MousePointerClick, Pencil, Trash2, Pause, Play, ExternalLink, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field, TextInput, Checkbox, BusyButton, fieldClass } from '@/components/forms/Form';
import { ImageField } from '@/components/dashboard/ImageField';
import { saveAd, toggleAd, deleteAd } from '@/actions/ads';
import {
  AD_PAGES,
  AD_POSITIONS,
  AD_STATUS_LABELS,
  adIsInternal,
  placementKey,
  type AdStatus,
} from '@/lib/ads';
import type { AdWithStats } from '@/data/domains/(admin)/ads/queries';
import { isoToCairoLocal } from '@/lib/promotions';

/**
 * شاشة الإعلانات.
 *
 * ⚠️ **التواريخ بتتعرض وبتتكتب بتوقيت القاهرة** (`isoToCairoLocal`
 *    للعرض، والتحويل العكسي في الأكشن). خانة `datetime-local`
 *    مالهاش منطقة زمنية، فالإدارة بتكتب بتوقيتها واللي بيتخزّن UTC.
 */

const STATUS_TONE: Record<AdStatus, string> = {
  live: 'bg-emerald-50 text-emerald-800',
  scheduled: 'bg-sky-50 text-sky-800',
  paused: 'bg-amber-50 text-amber-800',
  ended: 'bg-slate-100 text-slate-600',
};

const POSITION_LABEL: Record<(typeof AD_POSITIONS)[number], string> = {
  top: 'فوق',
  bottom: 'تحت',
};

export function AdsClient({ ads, countsFailed }: { ads: AdWithStats[]; countsFailed: boolean }) {
  const [editing, setEditing] = useState<AdWithStats | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);

  async function onToggle(ad: AdWithStats) {
    setBusyId(ad.id);
    const result = await toggleAd(ad.id, !ad.isActive);
    setBusyId(null);
    setMessage(
      result.ok
        ? { kind: 'ok', text: ad.isActive ? 'الإعلان اتوقف.' : 'الإعلان رجع يظهر.' }
        : { kind: 'err', text: result.error },
    );
  }

  async function onDelete(ad: AdWithStats) {
    // ⚠️ الحذف بيحذف النقرات معاه — الإدارة لازم تعرف قبل ما تدوس.
    const warning =
      ad.clicks > 0
        ? `حذف «${ad.title}» هيمسح كمان ${ad.clicks} نقرة مسجّلة عليه، ومفيش رجوع.\n\nلو محتاج تحتفظ بالأرقام، أوقفه بدل ما تحذفه.`
        : `حذف «${ad.title}»؟ مفيش رجوع.`;
    if (!window.confirm(warning)) return;
    setBusyId(ad.id);
    const result = await deleteAd(ad.id);
    setBusyId(null);
    setMessage(result.ok ? { kind: 'ok', text: 'الإعلان اتمسح.' } : { kind: 'err', text: result.error });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">الإعلانات</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {ads.length} إعلان · {totalClicks.toLocaleString('ar-EG')} نقرة
            {countsFailed && ' · تعذّر تحميل عدد النقرات'}
          </p>
        </div>
        {/* الزرار ده بيفتح الفورم بس — مفيش انتظار، فـ`busy` دايمًا false. */}
        <BusyButton busy={false} onClick={() => setEditing('new')} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          إعلان جديد
        </BusyButton>
      </div>

      {/* ⚠️ عدد النقرات لو فشل تحميله بيتقال صريح — صفر كذب. */}
      {countsFailed && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          تعذّر تحميل عدد النقرات، والأرقام تحت مش دقيقة. الإعلانات نفسها سليمة.
        </p>
      )}

      {message && (
        <p
          className={`rounded-xl p-3 text-sm font-bold ${
            message.kind === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </p>
      )}

      {editing && (
        <AdForm
          ad={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMessage({ kind: 'ok', text });
          }}
        />
      )}

      {ads.length === 0 && !editing ? (
        <Card className="p-8 text-center">
          <p className="font-bold text-slate-700">مفيش إعلانات لسه.</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            الخانات في الموقع بتفضل فاضية تمامًا لحد ما تضيف إعلان — مفيش مكان محجوز ولا فراغ.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <Card key={ad.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <img
                src={ad.imageUrl}
                alt=""
                className="h-20 w-full rounded-xl bg-slate-100 object-cover md:w-40"
                loading="lazy"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[ad.status]}`}>
                    {AD_STATUS_LABELS[ad.status]}
                  </span>
                  <h2 className="truncate font-black text-slate-800">{ad.title}</h2>
                </div>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  {ad.advertiserName || 'منصة الرحلة'}
                  {ad.linkUrl && (
                    <>
                      {' · '}
                      {adIsInternal(ad) ? (
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="inline h-3 w-3" aria-hidden="true" />
                          لينك داخلي
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                          لينك خارجي
                        </span>
                      )}
                    </>
                  )}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-400">
                  {ad.placements.length} مكان · ترتيب {ad.sortOrder}
                  {ad.startsAt && ` · من ${isoToCairoLocal(ad.startsAt).replace('T', ' ')}`}
                  {ad.endsAt && ` · إلى ${isoToCairoLocal(ad.endsAt).replace('T', ' ')}`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="flex items-center gap-1 text-lg font-black text-slate-800">
                    <MousePointerClick className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {ad.clicks.toLocaleString('ar-EG')}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400">نقرة</p>
                </div>

                <div className="flex gap-1">
                  <IconButton label="تعديل" onClick={() => setEditing(ad)} disabled={busyId === ad.id}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={ad.isActive ? 'إيقاف' : 'تشغيل'}
                    onClick={() => onToggle(ad)}
                    disabled={busyId === ad.id}
                  >
                    {ad.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </IconButton>
                  <IconButton
                    label="حذف"
                    onClick={() => onDelete(ad)}
                    disabled={busyId === ad.id}
                    tone="danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = 'plain',
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      /* ⚠️ ٤٤ بكسل — نفس حد اللمس اللي الموقع كله ماشي عليه. */
      className={`inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
        tone === 'danger'
          ? 'text-rose-600 hover:bg-rose-50'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function AdForm({
  ad,
  onClose,
  onSaved,
}: {
  ad: AdWithStats | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError('');
    const result = await saveAd(formData);
    setBusy(false);
    if (result.ok) onSaved(ad ? 'التعديل اتحفظ.' : 'الإعلان اتضاف.');
    else setError(result.error);
  }

  return (
    <Card accentColor="emerald" className="p-6">
      <h2 className="mb-4 text-lg font-black text-slate-800">
        {ad ? `تعديل: ${ad.title}` : 'إعلان جديد'}
      </h2>

      <form action={onSubmit} className="space-y-5">
        {ad && <input type="hidden" name="id" value={ad.id} />}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="عنوان الإعلان" name="title" required hint="للتعريف في اللوحة — مابيظهرش على البانر.">
            <TextInput name="title" defaultValue={ad?.title ?? ''} required maxLength={120} />
          </Field>

          <Field
            label="اسم المعلن"
            name="advertiserName"
            hint="سيبها فاضية لو الإعلان للمنصة نفسها."
          >
            <TextInput name="advertiserName" defaultValue={ad?.advertiserName ?? ''} maxLength={80} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ImageField
            name="imageUrl"
            label="صورة الإعلان (الكمبيوتر)"
            folder="alrehla/ads"
            value={ad?.imageUrl ?? ''}
            hint="بانر أفقي — بيتقص 6:1."
            library
          />
          <ImageField
            name="imageUrlMobile"
            label="صورة الموبايل (اختياري)"
            folder="alrehla/ads"
            value={ad?.imageUrlMobile ?? ''}
            hint="بيتقص 3:1. سيبها فاضية والموبايل هياخد الصورة الأساسية."
            library
          />
        </div>

        <Field
          label="لينك التحويل"
          name="linkUrl"
          hint="مسار داخلي زي /creative-writing/packages أو رابط خارجي بـ https://. سيبها فاضية لبانر من غير تحويل."
        >
          <TextInput name="linkUrl" defaultValue={ad?.linkUrl ?? ''} dir="ltr" />
        </Field>

        {/* ── الخانات ── */}
        <fieldset>
          <legend className="mb-1 text-sm font-bold text-slate-700">أماكن الظهور</legend>
          {/* ⚠️ الصفوف دي هي اللي بتخلّي نفس الإعلان في أكتر من مكان —
              مربّع لكل صفحة في كل موضع. */}
          <p className="mb-3 text-xs font-medium text-slate-500">
            اختر مكانًا واحدًا على الأقل. «فوق» = تحت بانر الصفحة قبل المحتوى، و«تحت» = آخر الصفحة.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs font-bold text-slate-500">
                  <th className="p-2 text-start">الصفحة</th>
                  {AD_POSITIONS.map((position) => (
                    <th key={position} className="p-2 text-center">
                      {POSITION_LABEL[position]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AD_PAGES.map((page) => (
                  <tr key={page.id} className="border-t border-slate-100">
                    <td className="p-2 font-bold text-slate-700">{page.label}</td>
                    {AD_POSITIONS.map((position) => {
                      const key = placementKey(page.id, position);
                      return (
                        <td key={position} className="p-2 text-center">
                          <input
                            type="checkbox"
                            name="placements"
                            value={key}
                            defaultChecked={ad?.placements.includes(key) ?? false}
                            aria-label={`${page.label} — ${POSITION_LABEL[position]}`}
                            className="h-5 w-5 accent-emerald-600"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        {/* ── التوقيت ── */}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="يبدأ" name="startsAt" hint="بتوقيت القاهرة. فاضي = يظهر فورًا.">
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={ad?.startsAt ? isoToCairoLocal(ad.startsAt) : ''}
              className={fieldClass}
            />
          </Field>

          <Field label="ينتهي" name="endsAt" hint="بتوقيت القاهرة. فاضي = بلا نهاية.">
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={ad?.endsAt ? isoToCairoLocal(ad.endsAt) : ''}
              className={fieldClass}
            />
          </Field>

          <Field label="ترتيب الظهور" name="sortOrder" hint="الأصغر يظهر أول في السلايدر.">
            <TextInput type="number" name="sortOrder" defaultValue={String(ad?.sortOrder ?? 0)} />
          </Field>
        </div>

        <Checkbox
          name="isActive"
          label="شغّال"
          defaultChecked={ad?.isActive ?? true}
          hint="الموقوف مايظهرش للزوّار مهما كان توقيته، ونقراته محفوظة."
        />

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <BusyButton type="submit" busy={busy} className="min-h-[44px]">
            {ad ? 'حفظ التعديل' : 'إضافة الإعلان'}
          </BusyButton>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Card>
  );
}
