import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import type { CustomizationField } from '@/lib/customization-fields';
import { ExtraFieldsSection } from './ExtraFieldsSection';

export function Step2CoverDetails({
  onNext,
  onPrev,
  extraFields = [],
}: {
  onNext: () => void;
  onPrev: () => void;
  /** خانات الإدارة (ملف 06). */
  extraFields?: CustomizationField[];
}) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  
  const coverPhotoFile = watch('coverPhotoFile');

  const [coverPhotoPreviewUrl, setCoverPhotoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverPhotoFile) {
      setCoverPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverPhotoFile);
    setCoverPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverPhotoFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setValue('coverPhotoFile', e.target.files[0], { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">تخصيص الغلاف</h2>
      <p className="text-slate-600">أضف لمسة شخصية على غلاف الكتاب.</p>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">إهداء أو رسالة على الغلاف (اختياري)</label>
        <textarea 
          {...register('dedicationText')}
          className="w-full h-24 rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="مثال: إلى بطلنا الصغير أحمد، نتمنى لك رحلة ممتعة مع هذه القصة..."
        />
        {errors.dedicationText && <span className="text-sm text-red-500">{errors.dedicationText.message as string}</span>}
      </div>

      <ExtraFieldsSection fields={extraFields} />

      <div className="space-y-2 pt-4 border-t border-slate-100">
        {/* ⚠️ «(اختياري)» اتشالت: التخصيص **هو** الصورة. الكلمة دي
            كانت بتخلّي العميل يعدّي الخطوة ويستلم نسخة عادية. */}
        <label className="text-sm font-bold text-slate-700">
          صورة الطفل للغلاف <span className="text-danger">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-2">يمكنك إرفاق صورة ليتم إدراجها في الغلاف الداخلي أو الخارجي.</p>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-base md:text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-base md:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {coverPhotoPreviewUrl && (
            <Image src={coverPhotoPreviewUrl} alt="معاينة صورة الغلاف المختارة" width={128} height={128} unoptimized className="mt-4 h-32 w-32 object-cover rounded-xl border border-slate-200" />
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
