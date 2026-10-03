import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useRouter, usePathname } from 'next/navigation';
import { PersonalizedProduct } from '@/types';
import { Button } from '@/components/ui/Button';
import { FormatChooser } from './FormatChooser';
import { cartNeedsShipping } from '@/lib/item-format';
import type { CustomizationField } from '@/lib/customization-fields';
import { ExtraFieldsReview } from './ExtraFieldsSection';

export function Step4Review({
  onPrev,
  product,
  pending = false,
  subscriptionMonths,
  extraFields = [],
}: {
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
  
  const goToStep = (step: number) => {
    router.push(`${pathname}?step=${step}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">مراجعة الطلب</h2>
      <p className="text-slate-600">تأكد من صحة البيانات قبل إضافة المنتج للسلة.</p>

      <div className="space-y-6 mt-6">
        {/* Child Info */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 relative">
          <button type="button" onClick={() => goToStep(1)} className="absolute top-6 left-6 text-sm font-bold text-blue-600 hover:underline">تعديل</button>
          <h3 className="font-bold text-slate-800 mb-4">بيانات الطفل</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block mb-1">الاسم:</span>
              <span className="font-bold text-slate-800">{values.newChildName || 'مشارك من العائلة'}</span>
            </div>
            {values.newChildBirthDate && (
              <div>
                <span className="text-slate-500 block mb-1">سنة الميلاد:</span>
                <span className="font-bold text-slate-800">{values.newChildBirthDate}</span>
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
                <span className="text-slate-500 block mb-1">الهدف التربوي:</span>
                <span className="font-bold text-slate-800">{values.storyGoal}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block mb-1">وصف البطل:</span>
              <span className="font-bold text-slate-800">{values.heroDescription}</span>
            </div>
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

        <FormatChooser product={product} />

        {/* إلكتروني من غير إضافات = مفيش شحن (ملف 138). */}
        <div className="rounded-2xl border border-blue-200 p-4 bg-blue-50 text-blue-800 text-sm font-bold text-center">
          {subscriptionMonths
            ? `صندوق كل شهر لمدة ${subscriptionMonths.toLocaleString('ar-EG')} شهور — مصاريف الشحن = سعر منطقتك × عدد الشهور، وبتتحسب في خطوة الدفع`
            : cartNeedsShipping([{ format: values.format, addonIds: values.selectedAddonIds }])
              ? 'سيتم إدخال بيانات الشحن في خطوة الدفع التالية'
              : 'مفيش شحن — هتكتب الإيميل اللي هتستلم عليه في خطوة الدفع'}
        </div>
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
          pendingText="جارٍ الإضافة…"
        >
          إضافة للسلة
        </Button>
      </div>
    </div>
  );
}
