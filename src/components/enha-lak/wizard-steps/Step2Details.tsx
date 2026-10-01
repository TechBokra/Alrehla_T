import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

/** نفس اختيارات الهدف — للقصة الواحدة وللاشتراك. */
const GOAL_OPTIONS = [
  { value: 'شجاعة', label: 'الشجاعة والتغلب على الخوف' },
  { value: 'ثقة', label: 'بناء الثقة بالنفس' },
  { value: 'حل المشكلات', label: 'تعلم حل المشكلات' },
  { value: 'تعاون', label: 'التعاون مع الآخرين' },
];

export function Step2Details({
  onNext,
  onPrev,
  monthlyGoals,
}: {
  onNext: () => void;
  onPrev: () => void;
  /** اشتراك صندوق الرحلة (ملف 140): عدد الشهور — هدف لكل شهر بدل هدف واحد. */
  monthlyGoals?: number;
}) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  
  const facePhotoFile = watch('facePhotoFile');
  const secondPhotoFile = watch('secondPhotoFile');

  const [facePhotoPreviewUrl, setFacePhotoPreviewUrl] = useState<string | null>(null);
  const [secondPhotoPreviewUrl, setSecondPhotoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!facePhotoFile) {
      setFacePhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(facePhotoFile);
    setFacePhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [facePhotoFile]);

  useEffect(() => {
    if (!secondPhotoFile) {
      setSecondPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(secondPhotoFile);
    setSecondPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [secondPhotoFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files.length > 0) {
      setValue(fieldName, e.target.files[0], { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">تفاصيل القصة</h2>

      {monthlyGoals ? (
        <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <legend className="px-2 text-sm font-bold text-slate-700">هدف قصة كل شهر (اختياري)</legend>
          <p className="text-xs text-slate-600">
            اختار من القايمة أو اكتب بكلامك. اللي تسيبه فاضي فريقنا بيختاره حسب سنّ الطفل.
          </p>
          <datalist id="goal-options">
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.label} />
            ))}
          </datalist>
          {Array.from({ length: monthlyGoals }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <label htmlFor={`goal-${i}`} className="w-20 shrink-0 text-sm font-bold text-slate-700">
                الشهر {(i + 1).toLocaleString('ar-EG')}
              </label>
              <input
                id={`goal-${i}`}
                list="goal-options"
                maxLength={200}
                placeholder="تختاره الإدارة"
                {...register(`monthlyGoals.${i}`)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </fieldset>
      ) : (<>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">الهدف التربوي (إلزامي)</label>
        <select 
          {...register('storyGoal')}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">اختر الهدف من القصة...</option>
          <option value="شجاعة">الشجاعة والتغلب على الخوف</option>
          <option value="ثقة">بناء الثقة بالنفس</option>
          <option value="حل المشكلات">تعلم حل المشكلات</option>
          <option value="تعاون">التعاون مع الآخرين</option>
          <option value="other">هدف آخر — أكتبه بنفسي</option>
        </select>
        {errors.storyGoal && <span className="text-sm text-red-500">{errors.storyGoal.message as string}</span>}
      </div>

      {watch('storyGoal') === 'other' && (
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">اكتب الهدف بكلامك</label>
          <textarea
            {...register('customStoryGoal')}
            className="h-20 w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="مثال: يتعوّد ينام في أوضته لوحده من غير خوف"
          />
          {errors.customStoryGoal && (
            <span className="text-sm text-red-500">{errors.customStoryGoal.message as string}</span>
          )}
        </div>
      )}
      </>)}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">إهداء أو رسالة في أول الكتاب (اختياري)</label>
        <textarea
          {...register('dedicationText')}
          className="h-20 w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="مثال: إلى نور… من بابا وماما، بكل الحب"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">وصف بطل القصة (إلزامي)</label>
        <textarea 
          {...register('heroDescription')}
          className="w-full h-24 rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="مثال: يحب الديناصورات، لونه المفضل الأزرق، لديه قطة اسمها بسبوس..."
        />
        {errors.heroDescription && <span className="text-sm text-red-500">{errors.heroDescription.message as string}</span>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">أسماء أفراد العائلة والأصدقاء (اختياري)</label>
        <textarea 
          {...register('familyMemberNames')}
          className="w-full h-20 rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="أدخل أسماء يمكن تضمينهم في أحداث القصة..."
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">الصورة الشخصية (إلزامي)</label>
          <p className="text-xs text-slate-500 mb-2">صورة واضحة للوجه ليتم رسم البطل بناءً عليها.</p>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'facePhotoFile')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {facePhotoPreviewUrl && (
             <Image src={facePhotoPreviewUrl} alt="معاينة صورة الوجه المختارة للطفل" width={128} height={128} unoptimized className="mt-4 h-32 w-32 object-cover rounded-xl border border-slate-200" />
          )}
          {errors.facePhotoFile && <span className="text-sm text-red-500">{errors.facePhotoFile.message as string}</span>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">صورة إضافية (اختياري)</label>
          <p className="text-xs text-slate-500 mb-2">للحيوان الأليف، لعبة مفضلة، أو زاوية أخرى.</p>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'secondPhotoFile')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {secondPhotoPreviewUrl && (
             <Image src={secondPhotoPreviewUrl} alt="معاينة الصورة الإضافية المختارة" width={128} height={128} unoptimized className="mt-4 h-32 w-32 object-cover rounded-xl border border-slate-200" />
          )}
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
