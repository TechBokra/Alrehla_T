import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useRouter, usePathname } from 'next/navigation';
import { PersonalizedProduct, type AddonProduct } from '@/types';
import { Button } from '@/components/ui/Button';
import { electronicAvailable, FORMAT_LABELS, itemNeedsShipping, type ItemFormat } from '@/lib/item-format';
import { ADDON_DELIVERY_TEXT, addonDeliveredAs } from '@/lib/addon-availability';
import { loadDeliveryRegion, type DeliveryRegion } from '@/lib/delivery-region-store';
import type { CustomizationField } from '@/lib/customization-fields';
import { ExtraFieldsReview } from './ExtraFieldsSection';
import { describeWritingStyle, type WritingDialect } from '@/lib/writing-style';

export function Step4Review({
  onPrev,
  product,
  pending = false,
  subscriptionMonths,
  extraFields = [],
  writingDialects = [],
  showWritingStyle = false,
  deliveryPaused = false,
  addons = [],
}: {
  /** التوصيل متوقف — النسخ اللي بتتشحن مقفولة في اختيار النسخة. */
  deliveryPaused?: boolean;
  /** عشان نعرف أنهي إضافة بتتشحن (قرار تامر، ٢٣ أكتوبر). */
  addons?: AddonProduct[];
  /** اللهجات — لعرض اسم اللهجة المختارة. */
  writingDialects?: WritingDialect[];
  /** خيار أسلوب الكتابة ظاهر في الخطوة ٢ (قصة مخصّصة واحدة). */
  showWritingStyle?: boolean;
  onPrev: () => void;
  /** خانات الإدارة (ملف 06). */
  extraFields?: CustomizationField[];
  product: PersonalizedProduct;
  /** الطلب بيتبعت دلوقتي — الزر بيقفل ويقول. */
  pending?: boolean;
  /** اشتراك الصندوق (ملف 140): بنعرض هدف كل شهر بدل هدف واحد. */
  subscriptionMonths?: number;
}) {
  const { watch } = useFormContext();
  const router = useRouter();
  const pathname = usePathname();

  const values = watch();
  const format: ItemFormat = (electronicAvailable(product) ? values.format : 'printed') ?? 'printed';
  const selectedIds: string[] = values.selectedAddonIds ?? [];
  const chosenAddons = addons.filter((a) => selectedIds.includes(a.id));
  const needsShipping = itemNeedsShipping({ format, addonIds: selectedIds, addonsNeedShipping: false });
  // المنطقة اللي اتختارت في خطوة ٣ (محفوظة على الجهاز).
  const [region, setRegion] = React.useState<DeliveryRegion | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- التخزين في المتصفح بس؛ القراية بعد أول رسم.
    setRegion(loadDeliveryRegion());
  }, []);
  
  const goToStep = (step: number) => {
    router.push(`${pathname}?step=${step}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">مراجعة الطلب</h2>
      <p className="text-slate-600">راجع البيانات، وبعدها على الدفع على طول.</p>

      <div className="space-y-6 mt-6">
        {/* General Info */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 relative">
          <button type="button" onClick={() => goToStep(1)} className="absolute top-6 left-6 text-sm font-bold text-blue-600 hover:underline">تعديل</button>
          <h3 className="font-bold text-slate-800 mb-4">البيانات</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block mb-1">الاسم:</span>
              <span className="font-bold text-slate-800">
                {values.newChildName || (values.familyMemberId === 'self' ? 'صاحب الحساب' : 'مشارك من العائلة')}
              </span>
              {values.familyMemberId === 'self' && (
                <span className="mr-2 text-xs font-semibold text-blue-600">(طلب شخصي)</span>
              )}
            </div>
            {values.newChildBirthDate && (
              <div>
                <span className="text-slate-500 block mb-1">تاريخ الميلاد:</span>
                <span className="font-bold text-slate-800">{values.newChildBirthDate}</span>
              </div>
            )}
            {values.newChildGender && (
              <div>
                <span className="text-slate-500 block mb-1">الجنس:</span>
                <span className="font-bold text-slate-800">
                  {values.newChildGender === 'male' ? 'ذكر' : values.newChildGender === 'female' ? 'أنثى' : values.newChildGender}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Story Details */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 relative">
          <button type="button" onClick={() => goToStep(2)} className="absolute top-6 left-6 text-sm font-bold text-blue-600 hover:underline">تعديل</button>
          <h3 className="font-bold text-slate-800 mb-4">تفاصيل القصة</h3>
          <div className="space-y-4 text-sm">
            {subscriptionMonths ? (
              <div>
                <span className="text-slate-500 block mb-1">أهداف الشهور:</span>
                <ol className="space-y-1">
                  {Array.from({ length: subscriptionMonths }, (_, i) => (
                    <li key={i} className="font-bold text-slate-800">
                      الشهر {(i + 1).toLocaleString('ar-EG')}:{' '}
                      {values.monthlyGoals?.[i]?.trim() || (
                        <span className="font-medium text-slate-600">تختاره الإدارة</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div>
                <span className="text-slate-500 block mb-1">الهدف الأساسي:</span>
                <span className="font-bold text-slate-800">{values.storyGoal}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block mb-1">وصف البطل:</span>
              <span className="font-bold text-slate-800">{values.heroDescription}</span>
            </div>
            {showWritingStyle && (
              <div>
                <span className="text-slate-500 block mb-1">أسلوب الكتابة:</span>
                <span className="font-bold text-slate-800">
                  {describeWritingStyle(
                    { style: values.writingStyle, dialect: values.writingDialect },
                    writingDialects,
                  ) ?? 'لم يتم الاختيار'}
                </span>
              </div>
            )}
            <ExtraFieldsReview fields={extraFields} answers={values.extraFields} />
            <div>
              <span className="text-slate-500 block mb-1">الصور المرفقة:</span>
              <span className="font-bold text-slate-800">
                {values.facePhotoFile ? 'تم رفع الصورة الشخصية' : 'لم يتم الإرفاق'} 
                {values.secondPhotoFile && ' + صورة إضافية'}
              </span>
            </div>
          </div>
        </div>

        {/* الصورة مش بتتحفظ مع تحديث الصفحة — بنقول قبل الضغط مش بعده. */}
        {!values.facePhotoFile && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-900">
            الصورة الشخصية مش مرفوعة — غالبًا الصفحة اتحدّثت والصور مبتتحفظش
            مع التحديث.{' '}
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="underline underline-offset-4"
            >
              ارجع للخطوة ٢ وارفعها
            </button>
          </div>
        )}

        {/* ══ النسخة والتوصيل والإضافات ═══════════════════════
            ⚠️ اختيار النسخة اتنقل لخطوة ٣ (قبل الإضافات) — هنا ملخص
               وزرار «تعديل» بس (قرار ٢٤ أكتوبر). */}
        {!subscriptionMonths && (
          <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="absolute top-6 left-6 text-sm font-bold text-blue-600 hover:underline"
            >
              تعديل
            </button>
            <h3 className="mb-4 font-bold text-slate-800">
              {electronicAvailable(product) ? 'النسخة والتوصيل والإضافات' : 'التوصيل والإضافات'}
            </h3>
            <div className="space-y-3 text-sm">
              {electronicAvailable(product) && (
                <div>
                  <span className="mb-1 block text-slate-500">النسخة:</span>
                  <span className="font-bold text-slate-800">{FORMAT_LABELS[format]}</span>
                </div>
              )}
              <div>
                <span className="mb-1 block text-slate-500">التوصيل:</span>
                <span className="font-bold text-slate-800">
                  {format === 'electronic'
                    ? 'على الإيميل — من غير شحن'
                    : region?.city
                      ? `${region.gov} — ${region.city}`
                      : 'بتختار المنطقة في الدفع'}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-slate-500">الإضافات:</span>
                {chosenAddons.length === 0 ? (
                  <span className="font-bold text-slate-800">من غير إضافات</span>
                ) : (
                  <ul className="space-y-1">
                    {chosenAddons.map((a) => (
                      <li key={a.id} className="font-bold text-slate-800">
                        {a.name}{' '}
                        <span className="font-medium text-slate-500">
                          — {ADDON_DELIVERY_TEXT[addonDeliveredAs(a, format)]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {subscriptionMonths ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-bold text-blue-800">
            صندوق كل شهر لمدة {subscriptionMonths.toLocaleString('ar-EG')} شهور — مصاريف الشحن = سعر منطقتك × عدد
            الشهور، وبتتحسب في خطوة الدفع
          </div>
        ) : needsShipping && deliveryPaused ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            الطلب ده محتاج شحن، والتوصيل متوقف مؤقتًا — ارجع لخطوة ٣ واختار النسخة الإلكترونية.
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-bold text-blue-800">
            {needsShipping
              ? 'الخطوة الجاية: العنوان بالتفصيل والدفع'
              : 'الخطوة الجاية: الإيميل اللي هتستلم عليه والدفع'}
          </div>
        )}
      </div>
      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl bg-slate-100 px-8 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          السابق
        </button>
        {/* ⚠️ الزر ده كان `<button type="submit">` عادي: لو التحقق رفض،
            مكانش بيحصل **ولا حاجة** ولا بتظهر رسالة. دلوقتي المعالج
            بيعرض السبب ويرجّع للخطوة الناقصة، والزر بيقول إنه شغّال. */}
        <Button
          type="submit"
          accentColor="journey"
          pending={pending}
          pendingText="لحظة…"
        >
          {/* بيروح للدفع على طول (قرار ٢٤ أكتوبر) — الطلب بيتحفظ في
              السلة كمان، فلو رجع مايضيعش. */}
          متابعة للدفع
        </Button>
      </div>
    </div>
  );
}
