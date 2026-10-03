import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useRouter, usePathname } from 'next/navigation';
import { PersonalizedProduct } from '@/types';
import { Button } from '@/components/ui/Button';
import type { CustomizationField } from '@/lib/customization-fields';
import { ExtraFieldsReview } from './ExtraFieldsSection';

export function Step3LibraryReview({
  onPrev,
  product,
  pending = false,
  extraFields = [],
}: {
  onPrev: () => void;
  product: PersonalizedProduct;
  /** خانات الإدارة (ملف 06). */
  extraFields?: CustomizationField[];
  /** الطلب بيتبعت دلوقتي. */
  pending?: boolean;
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
      <h2 className="text-2xl font-black text-slate-800">مراجعة التخصيص</h2>
      <p className="text-slate-600">تأكد من صحة البيانات قبل إضافة الكتاب للسلة.</p>

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

        {/* Cover Details */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 relative">
          <button type="button" onClick={() => goToStep(2)} className="absolute top-6 left-6 text-sm font-bold text-blue-600 hover:underline">تعديل</button>
          <h3 className="font-bold text-slate-800 mb-4">تخصيص الغلاف</h3>
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-slate-500 block mb-1">نص الإهداء:</span>
              <span className="font-bold text-slate-800">{values.dedicationText || 'بدون إهداء'}</span>
            </div>
            <ExtraFieldsReview fields={extraFields} answers={values.extraFields} />
            <div>
              <span className="text-slate-500 block mb-1">الصور المرفقة:</span>
              <span className="font-bold text-slate-800">
                {values.coverPhotoFile ? 'تم إرفاق صورة للغلاف' : 'لم يتم الإرفاق'}
              </span>
            </div>
          </div>
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
        <Button type="submit" accentColor="journey" pending={pending} pendingText="جارٍ الإضافة…">
          إضافة للسلة
        </Button>
      </div>
    </div>
  );
}
