import { formatPrice } from '@/lib/utils';
import React from 'react';
import Image from 'next/image';
import { ExternalLink, Mail, Truck } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { useFormContext } from 'react-hook-form';
import type { AddonProduct, PersonalizedProduct } from '@/types';
import type { DeliveryCatalog } from '@/data/domains/(shared)/shipping/types';
import { addonCustomerPrice, customizedAddonIdsFor, electronicAvailable, type ItemFormat } from '@/lib/item-format';
import { ADDON_DELIVERY_TEXT, addonAllowedWith, addonDeliveredAs, keepAllowedAddons } from '@/lib/addon-availability';
import { PAUSED_MESSAGE } from '@/lib/delivery';
import { FormatChooser } from './FormatChooser';
import { DeliveryRegionPicker, useDeliveryRegion } from './DeliveryRegionPicker';

/**
 * خطوة ٣ — **النسخة والتوصيل والإضافات** (قرار تامر، ٢٤ أكتوبر).
 *
 * الترتيب مقصود:
 *   ١) النسخة (مطبوعة / إلكترونية / الاتنين) — لو المنتج ليه إلكتروني
 *   ٢) «هنوصّل فين؟» — لو النسخة بتتشحن
 *   ٣) الإضافات — **المناسبة للنسخة والمنطقة بس**
 *
 * ⚠️ قبل كده النسخة كانت بتتختار في المراجعة (بعد الإضافات)، والمنطقة
 *    في الدفع (بعد كل حاجة). فالعميل كان بيختار بوستر مطبوع، وبعدين
 *    نسخة إلكترونية، وبعدين يكتشف في الدفع إن منطقته مافيهاش توصيل.
 *
 * ⚠️ الأسعار للعرض بس. `create_customer_order` بتسعّر من الجدول،
 *    و`guard_order_item_addons` بترفض الإضافة المطبوعة مع الإلكتروني.
 */
export function Step3Addons({
  onNext,
  onPrev,
  addons,
  deliveryPaused = false,
  pauseMessage = '',
  product,
  delivery,
}: {
  onNext: () => void;
  onPrev: () => void;
  addons: AddonProduct[];
  deliveryPaused?: boolean;
  pauseMessage?: string;
  /** عشان اختيار النسخة. من غيره (المكتبة) النسخة مطبوعة دايمًا. */
  product?: PersonalizedProduct;
  /** الدول والمحافظات والمناطق — لـ«هنوصّل فين؟». */
  delivery?: DeliveryCatalog;
}) {
  const { watch, setValue } = useFormContext();
  const watchedAddons = watch('selectedAddonIds');
  const selectedAddons: string[] = React.useMemo(() => watchedAddons ?? [], [watchedAddons]);
  const hasElectronic = Boolean(product && electronicAvailable(product));
  const format: ItemFormat = (hasElectronic ? watch('format') : 'printed') ?? 'printed';
  const needsShipping = format !== 'electronic';

  const { region, update, verdict, chosen } = useDeliveryRegion(delivery);
  const [error, setError] = React.useState('');

  // ── التوصيل مقفول؟ (إيقاف عام، أو منطقة العميل) ─────────────
  const pauseText = pauseMessage.trim() || PAUSED_MESSAGE;
  const physicalBlocked: string | null = deliveryPaused
    ? pauseText
    : delivery && chosen && verdict && !verdict.available
      ? verdict.message
      : null;

  // المنطقة اتقفلت والمنتج ليه إلكتروني ← نحوّله، ونقول ليه.
  React.useEffect(() => {
    if (physicalBlocked && hasElectronic && format !== 'electronic') {
      setValue('format', 'electronic', { shouldDirty: true });
    }
  }, [physicalBlocked, hasElectronic, format, setValue]);

  // النسخة اتغيّرت ← الإضافات اللي ماتنفعش معاها بتتشال.
  React.useEffect(() => {
    const keep = keepAllowedAddons(addons, selectedAddons, format);
    if (keep.length !== selectedAddons.length) {
      setValue('selectedAddonIds', keep);
      setValue('customizedAddonIds', customizedAddonIdsFor(addons, keep));
    }
  }, [format, addons, selectedAddons, setValue]);

  const visible = addons.filter((a) => addonAllowedWith(a, format));
  const hiddenCount = addons.length - visible.length;

  const toggleAddon = (id: string) => {
    const addon = addons.find((a) => a.id === id);
    if (!addon || !addonAllowedWith(addon, format)) return;
    const next = selectedAddons.includes(id) ? selectedAddons.filter((a) => a !== id) : [...selectedAddons, id];
    setValue('selectedAddonIds', next);
    // التخصيص ماشي ورا الاختيار — مش قرار منفصل.
    setValue('customizedAddonIds', customizedAddonIdsFor(addons, next));
  };

  const next = () => {
    setError('');
    if (needsShipping && physicalBlocked) {
      setError(
        hasElectronic
          ? `${physicalBlocked} — اختار النسخة الإلكترونية وكمّل.`
          : `${physicalBlocked} — والنسخة دي بتتطبع وبتتشحن بس، فمش هينفع تتطلب لمنطقتك دلوقتي.`,
      );
      return;
    }
    if (needsShipping && delivery && !region.city) {
      setError('اختار المحافظة والمنطقة عشان نتأكد إننا بنوصّل لك.');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">
          {hasElectronic ? 'النسخة والإضافات' : 'التوصيل والإضافات'}
        </h2>
        <p className="mt-1 text-slate-600">
          {hasElectronic
            ? 'اختار النسخة الأول — الإضافات اللي تحت بتتغيّر على حسبها.'
            : 'اختار منطقتك عشان نتأكد إننا بنوصّل لك، وبعدين الإضافات لو حابب.'}
        </p>
      </div>

      {product && <FormatChooser product={product} physicalBlocked={physicalBlocked} />}

      {/* السبب بيتقال طول ما هو قائم — مش رسالة بتظهر مرة وتختفي. */}
      {physicalBlocked && hasElectronic && format === 'electronic' && (
        <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">
          الطلب على النسخة الإلكترونية لأن التوصيل مش متاح لمنطقتك — وبتوصلك على الإيميل.
        </p>
      )}

      {/* بيفضل ظاهر لما المنطقة تكون السبب في التحويل للإلكتروني — عشان
          العميل يقدر يغيّرها (لو اختار غلط) ويرجع للمطبوع. */}
      {delivery && !deliveryPaused && (needsShipping || Boolean(physicalBlocked)) && (
        <DeliveryRegionPicker
          catalog={delivery}
          region={region}
          onChange={(r) => {
            setError('');
            update(r);
          }}
          verdict={verdict}
          chosen={chosen}
        />
      )}

      {needsShipping && deliveryPaused && !hasElectronic && (
        <div role="status" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <Truck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold leading-relaxed">{pauseText}</p>
        </div>
      )}

      {format === 'electronic' && (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          النسخة الإلكترونية من غير شحن — فالإضافات اللي بتوصل على الإيميل بس هي اللي ظاهرة.
        </p>
      )}

      <section aria-labelledby="addons-title" className="space-y-4">
        <div>
          <h3 id="addons-title" className="text-lg font-black text-slate-800">
            إضافات مميزة (اختياري)
          </h3>
          <p className="text-sm text-slate-600">كل إضافة بتتعمل مخصوص بالاسم والصورة اللي حددتهم، والسعر شامل التخصيص.</p>
        </div>

        {visible.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
            {addons.length === 0
              ? 'مفيش إضافات متاحة حاليًا — كمّل عادي.'
              : 'مفيش إضافات بتوصل على الإيميل دلوقتي — كمّل عادي.'}
          </p>
        )}

        {visible.map((addon) => {
          const isSelected = selectedAddons.includes(addon.id);
          const shownPrice = addonCustomerPrice(addon);
          const deliveredAs = addonDeliveredAs(addon, format);
          return (
            <div
              key={addon.id}
              className={`rounded-2xl border-2 transition-colors ${
                isSelected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleAddon(addon.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAddon(addon.id);
                  }
                }}
                className="flex cursor-pointer items-start gap-4 p-5"
              >
                <div
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}
                >
                  {isSelected && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {addon.imageUrl && (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-20 sm:w-20">
                    <Image
                      src={optimizedImageUrl(addon.imageUrl, 240)}
                      alt={addon.name}
                      fill
                      sizes="(min-width: 640px) 80px, 56px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800">{addon.name}</h4>
                  {addon.description && <p className="mt-1 text-sm text-slate-600">{addon.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      مخصصة بالاسم والصورة
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {ADDON_DELIVERY_TEXT[deliveredAs]}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 font-black text-emerald-700">
                  +{formatPrice(shownPrice)}
                  {addon.listPrice !== undefined && addon.listPrice > addon.price && (
                    <del className="mr-2 text-xs font-medium text-slate-500">
                      {formatPrice(addon.listPrice + (addon.customizationPrice ?? 0))}
                    </del>
                  )}
                </div>
              </div>
              {/* صفحة الإضافة (ملف 19) في تاب جديد — عشان التخصيص اللي اتكتب مايضيعش. */}
              <div className="-mt-2 px-5 pb-4 text-end">
                <a
                  href={`/enha-lak/addon/${addon.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
                >
                  التفاصيل والصور
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          );
        })}

        {hiddenCount > 0 && format === 'electronic' && (
          <p className="text-xs font-medium text-slate-500">
            {hiddenCount === 1
              ? 'فيه إضافة مطبوعة واحدة'
              : `فيه ${hiddenCount.toLocaleString('ar-EG')} إضافات مطبوعة`}{' '}
            مش ظاهرة لأنها بتتشحن — بتظهر مع النسخة المطبوعة.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-between border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl bg-slate-100 px-8 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          السابق
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white transition-colors hover:bg-blue-700"
        >
          الخطوة التالية
        </button>
      </div>
    </div>
  );
}
