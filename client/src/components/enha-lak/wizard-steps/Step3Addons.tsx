import { formatPrice } from '@/lib/utils';
import React from 'react';
import Image from 'next/image';
import { ExternalLink, Truck } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { useFormContext } from 'react-hook-form';
import { AddonProduct } from '@/types';
import { addonCustomerPrice, addonNeedsShipping, customizedAddonIdsFor } from '@/lib/item-format';
import { PAUSED_MESSAGE } from '@/lib/delivery';

/**
 * الإضافات بتيجي من قاعدة البيانات (جدول `addon_products`) عن طريق
 * الصفحة، مش مكتوبة هنا. قبل كده كانت تلات إضافات بأسعار في كود
 * المتصفح، وبعدين قايمة فاضية ثابتة.
 *
 * ── التخصيص (ملف 07 — قرار تامر) ───────────────────────────
 *
 * **التخصيص مش اختياري — هو هدف المشروع.** كان فيه «بتخصيص / بدون»؛
 * دلوقتي أي إضافة بتقبل التخصيص بتتخصص دايمًا بنفس اسم الطفل وصورته
 * اللي اتكتبوا للقصة أو الغلاف، وسعرها المعروض شامل التخصيص. مفيش
 * خانات جديدة يملاها العميل.
 *
 * ⚠️ الأسعار المعروضة هنا للعرض فقط. `create_customer_order` بتقرا
 *    السعر و`customization_price` من الجدول، **وبتخصّص لوحدها** أي
 *    إضافة بتقبل التخصيص — تلاعب المتصفح مبيعدّيش.
 */
/** نوع الإضافة زي ما العميل يفهمه. */
const DELIVERY_HINT: Record<string, string> = {
  printed: 'بتتشحن لعنوانك',
  electronic: 'بتوصلك على الإيميل — من غير شحن',
  both: 'بتتشحن لعنوانك ومعاها نسخة إلكترونية',
};

export function Step3Addons({
  onNext,
  onPrev,
  addons,
  deliveryPaused = false,
  pauseMessage = '',
}: {
  onNext: () => void;
  onPrev: () => void;
  addons: AddonProduct[];
  /**
   * التوصيل مقفول؟ ساعتها **مفيش إضافة تتطلب خالص**.
   *
   * ⚠️ كل إضافة حاجة ملموسة بتتشحن — القاعدة نفسها بتقول
   *    «الشحن لو فيه مطبوع **أو إضافة**». فالشاشة كانت بتسيبه
   *    يختار بوسترًا والتوصيل مقفول، وبعدين يموت في الدفع.
   */
  deliveryPaused?: boolean;
  pauseMessage?: string;
}) {
  const { watch, setValue } = useFormContext();
  const watchedAddons = watch('selectedAddonIds');
  // ⚠️ `|| []` بتطلّع مصفوفة جديدة كل رسم، والتأثير تحت بيعتمد عليها
  //    — يعني بيشتغل كل مرة. `useMemo` بتثبّت المرجع.
  const selectedAddons: string[] = React.useMemo(() => watchedAddons ?? [], [watchedAddons]);

  /**
   * ⚠️ **تنضيف الاختيار القديم.** العميل ممكن يكون اختار إضافات
   *    قبل ما الإدارة توقف التوصيل، والنموذج محفوظ في المتصفح.
   *    من غير السطر ده بيرجع للخطوة ويلاقي بوستر متعلّم والزرار
   *    مقفول — وبيدوّر على سبب مش ظاهر.
   */
  /** الإضافة دي مقفولة دلوقتي؟ الإلكترونية بتفضل متاحة. */
  const blockedFor = React.useCallback(
    (addon: AddonProduct) => deliveryPaused && addonNeedsShipping(addon),
    [deliveryPaused],
  );

  React.useEffect(() => {
    if (!deliveryPaused) return;
    // ⚠️ **اللي بيتشال هو اللي بيتشحن وبس** (قرار تامر، ٢٣ أكتوبر).
    //    قبل كده كنت بشيل الاختيار كله لما التوصيل يقف — وده كان
    //    بيلغي ملف تلوين إلكتروني مالوش أي علاقة بالشحن.
    const keep = selectedAddons.filter((id) => {
      const addon = addons.find((a) => a.id === id);
      return addon ? !addonNeedsShipping(addon) : false;
    });
    if (keep.length !== selectedAddons.length) {
      setValue('selectedAddonIds', keep);
      setValue('customizedAddonIds', customizedAddonIdsFor(addons, keep));
    }
  }, [deliveryPaused, selectedAddons, addons, setValue]);

  const toggleAddon = (id: string) => {
    const addon = addons.find((a) => a.id === id);
    if (addon && blockedFor(addon)) return;
    const next = selectedAddons.includes(id)
      ? selectedAddons.filter((a) => a !== id)
      : [...selectedAddons, id];
    setValue('selectedAddonIds', next);
    // التخصيص ماشي ورا الاختيار — مش قرار منفصل.
    setValue('customizedAddonIds', customizedAddonIdsFor(addons, next));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">إضافات مميزة (اختياري)</h2>
      <p className="text-slate-600">
        كل إضافة بتتعمل مخصوص بالاسم والصورة اللي حددتهم، والسعر
        شامل التخصيص.
      </p>

      {/* ══ التوصيل مقفول ═══════════════════════════════════════
          كل إضافة حاجة ملموسة بتتشحن — فمفيش ولا واحدة تتطلب
          دلوقتي. والعميل لازم يعرف ده **هنا**، مش في آخر خطوة. */}
      {/* ⚠️ البانر بيظهر بس لو فيه إضافة بتتشحن فعلًا — تحذير عن
          حاجة مالهاش وجود في القايمة بيخلّي العميل يدوّر عليها. */}
      {deliveryPaused && addons.some(addonNeedsShipping) && (
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900"
        >
          <Truck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-black">الإضافات اللي بتتشحن مش متاحة دلوقتي</p>
            <p className="mt-1 text-sm font-medium leading-relaxed">
              {pauseMessage.trim() || PAUSED_MESSAGE}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed">
              الإضافات الملموسة بتتشحن لحد عندك، فمش هينفع تتطلب والتوصيل متوقف.
              والإضافات اللي بتوصل على الإيميل متاحة عادي.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 mt-6">
        {addons.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
            مفيش إضافات متاحة حاليًا — كمّل عادي.
          </p>
        )}
        {addons.map((addon) => {
          const blocked = blockedFor(addon);
          const isSelected = selectedAddons.includes(addon.id) && !blocked;
          // السعر شامل التخصيص — كل الإضافات بتتخصص (ملف 08).
          const shownPrice = addonCustomerPrice(addon);

          return (
            <div
              key={addon.id}
              className={`rounded-2xl border-2 transition-colors ${
                blocked
                  ? 'border-slate-200 bg-slate-50 opacity-60'
                  : isSelected
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div
                role="checkbox"
                aria-checked={isSelected}
                aria-disabled={blocked || undefined}
                tabIndex={blocked ? -1 : 0}
                onClick={() => toggleAddon(addon.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAddon(addon.id);
                  }
                }}
                className={`flex items-start gap-4 p-5 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}
                >
                  {isSelected && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {/* صورة اختيارية (ملف 12) — صغيرة عشان الموبايل يفضل فيه مكان للاسم والسعر. */}
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
                  <h3 className="font-bold text-slate-800">{addon.name}</h3>
                  {addon.description && (
                    <p className="text-sm text-slate-600 mt-1">{addon.description}</p>
                  )}
                  <p className="mt-2 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    مخصصة بالاسم والصورة
                  </p>
                  {/* نوع الإضافة — العميل لازم يعرف دي بتتشحن ولا بتوصل
                      على الإيميل **قبل** ما يختارها. */}
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {DELIVERY_HINT[addon.deliveryFormat] ?? DELIVERY_HINT.printed}
                  </p>
                  {blocked && (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      غير متاحة — التوصيل متوقف مؤقتًا
                    </p>
                  )}
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
              {/* صفحة الإضافة (ملف 19) في تاب جديد — عشان التخصيص اللي اتكتب
                  مايضيعش. وبرّه خانة الاختيار عشان الضغطة ماتختارهاش. */}
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
      </div>

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl bg-slate-100 px-8 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          السابق
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white transition-colors hover:bg-blue-700"
        >
          الخطوة التالية
        </button>
      </div>
    </div>
  );
}
