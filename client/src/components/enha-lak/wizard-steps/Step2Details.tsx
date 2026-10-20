import Image from 'next/image';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useObjectUrl } from '@/lib/use-object-url';
import { isSavedPhoto } from '@/lib/saved-photo';
import type { CustomizationField } from '@/lib/customization-fields';
import { DEFAULT_GOALS, type StoryGoal } from '@/lib/story-goals';
import { ExtraFieldsSection } from './ExtraFieldsSection';
import { photoFileProblem } from '@/lib/private-upload-client';
import {
  availableStyles,
  WRITING_STYLE_HINTS,
  WRITING_STYLE_LABELS,
  type WritingDialect,
} from '@/lib/writing-style';

export function Step2Details({
  onNext,
  onPrev,
  monthlyGoals,
  extraFields = [],
  goals = [],
  writingStyles,
  writingDialects = [],
}: {
  onNext: () => void;
  onPrev: () => void;
  /** خانات الإدارة (ملف 06). */
  extraFields?: CustomizationField[];
  /**
   * أهداف الإدارة للمنتج ده (ملف 12) — نفس القايمة للقصة الواحدة وللاشتراك.
   *
   * ⚠️ القيمة المحفوظة = نص الهدف نفسه، مش رقمه: لو الإدارة غيّرته أو
   *    مسحته بعدين، الطلب بيفضل مقروء. (الطلبات الأقدم حافظة كلمة قصيرة
   *    زي «شجاعة» وبتتترجم في `order-customization.ts`.)
   */
  goals?: StoryGoal[];
  /** اشتراك صندوق الرحلة (ملف 140): عدد الشهور — هدف لكل شهر بدل هدف واحد. */
  monthlyGoals?: number;
  /**
   * أساليب الكتابة المتاحة (القصة المخصّصة بس). `undefined` = الخيار مخفي
   * (الاشتراك والمنتجات التانية)، و`[]`/`null` ممنوعين: المعالج بيبعت قايمة.
   */
  writingStyles?: string[] | null;
  /** اللهجات الفعّالة من القاعدة. */
  writingDialects?: WritingDialect[];
}) {
  const { register, watch, setValue, setError, formState: { errors } } = useFormContext();
  // فاضية = الإدارة أوقفت كله أو حددته لمنتجات تانية — الهدف إلزامي، فنرجع
  // للأربعة الأساسيين بدل ما العميل يضطر يكتب «هدف آخر».
  const goalOptions = goals.length > 0 ? goals : DEFAULT_GOALS;
  
  const styleOptions = writingStyles === undefined
    ? []
    : availableStyles(writingStyles).filter((s) => s !== 'dialect' || writingDialects.length > 0);
  const selectedStyle = watch('writingStyle');

  const facePhotoFile = watch('facePhotoFile');
  const secondPhotoFile = watch('secondPhotoFile');
  // ⚠️ في وضع التعديل الخانة بتحمل صورة **مرفوعة قبل كده** مش ملف
  //    جديد، فمفيش معاينة محلية ليها — بنقول للعميل إنها محفوظة.
  const savedPhoto = (v: unknown) => isSavedPhoto(v);
  const facePhotoPreviewUrl = useObjectUrl(facePhotoFile);
  const secondPhotoPreviewUrl = useObjectUrl(secondPhotoFile);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // الغلط يظهر **هنا** تحت الخانة، مش في آخر خطوة (اختبار HS0L).
    const problem = photoFileProblem(file);
    if (problem) {
      e.target.value = '';
      setValue(fieldName, undefined);
      setError(fieldName, { type: 'manual', message: problem });
      return;
    }
    setValue(fieldName, file, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">تفاصيل القصة</h2>

      {monthlyGoals ? (
        <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <legend className="px-2 text-sm font-bold text-slate-700">هدف قصة كل شهر (اختياري)</legend>
          <p className="text-xs text-slate-600">
            اختار من القايمة أو اكتب بكلامك. اللي تسيبه فاضي فريقنا بيختاره بما يناسب القصة والعمر.
          </p>
          <datalist id="goal-options">
            {goalOptions.map((g) => (
              <option key={g.id} value={g.label} />
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
        <label className="text-sm font-bold text-slate-700">الهدف الأساسي (إلزامي)</label>
        <select 
          {...register('storyGoal')}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">اختر الهدف من القصة...</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.label}>
              {g.label}
            </option>
          ))}
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

      {styleOptions.length > 0 && (
        <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <legend className="px-2 text-sm font-bold text-slate-700">أسلوب كتابة القصة (إلزامي)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {styleOptions.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors ${
                  selectedStyle === s ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-800">
                  <input type="radio" value={s} {...register('writingStyle')} />
                  {WRITING_STYLE_LABELS[s]}
                </span>
                <span className="text-xs text-slate-600">{WRITING_STYLE_HINTS[s]}</span>
              </label>
            ))}
          </div>
          {selectedStyle === 'dialect' && (
            <div className="space-y-2">
              <label htmlFor="writing-dialect" className="text-sm font-bold text-slate-700">
                اختار اللهجة
              </label>
              <select
                id="writing-dialect"
                {...register('writingDialect')}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">اختر اللهجة...</option>
                {writingDialects.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>
      )}

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
          placeholder="أخبرنا عن شخصية بطل الحكاية واهتماماته وأبرز صفاته، وأي تفاصيل ترغب في مشاركتها معنا."
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

      <ExtraFieldsSection fields={extraFields} />

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
          {facePhotoPreviewUrl ? (
             <Image src={facePhotoPreviewUrl} alt="معاينة الصورة الشخصية المختارة" width={128} height={128} unoptimized className="mt-4 h-32 w-32 object-cover rounded-xl border border-slate-200" />
          ) : savedPhoto(facePhotoFile) ? (
            /* وضع التعديل: الصورة مرفوعة قبل كده ومحفوظة — مش هنطلبها تاني. */
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              الصورة اللي رفعتها قبل كده محفوظة. ارفع صورة جديدة بس لو عايز تغيّرها.
            </p>
          ) : null}
          {errors.facePhotoFile && <span className="text-sm text-red-500">{errors.facePhotoFile.message as string}</span>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">صورة إضافية (اختياري)</label>
          <p className="text-xs text-slate-500 mb-2">أي صورة أخرى تحب تظهر في القصة.</p>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'secondPhotoFile')}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {secondPhotoPreviewUrl ? (
             <Image src={secondPhotoPreviewUrl} alt="معاينة الصورة الإضافية المختارة" width={128} height={128} unoptimized className="mt-4 h-32 w-32 object-cover rounded-xl border border-slate-200" />
          ) : savedPhoto(secondPhotoFile) ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              الصورة الإضافية اللي رفعتها قبل كده محفوظة.
            </p>
          ) : null}
          {errors.secondPhotoFile && <span className="text-sm text-red-500">{errors.secondPhotoFile.message as string}</span>}
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
