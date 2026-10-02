import React from 'react';
import { GalleryField } from '@/components/dashboard/GalleryField';
import { ProductAgeFields } from '@/components/dashboard/ProductAgeFields';

/**
 * محتوى صفحة المنتج: الوصف الكامل · معرض الصور · التفاصيل · السنّ.
 *
 * ═══════════════════════════════════════════════════════════
 * 🔴 ليه مكوّن واحد للأربع نماذج
 * ═══════════════════════════════════════════════════════════
 *
 * الخانات دي كانت مكتوبة يدويًّا في نموذجَي الإدارة — **وناقصة
 * بالكامل من نموذجَي الناشر**. والحفظ كان بيكتب الناقص `null`، فأي
 * تصحيح من الناشر كان بيمسح صور الإدارة ووصفها في صمت.
 *
 * الخادم اتقفل بـ`onlySentFields`، والنماذج الأربعة بقت بتستعمل
 * المكوّن ده — **فالخانة اللي تتضاف هنا بتوصل للأربعة مرة واحدة**.
 * (درس ٢٠: الإصلاح في مكان بيفوت الأماكن اللي بتعيد كتابة نفس الشكل
 * يدويًّا.)
 *
 * ⚠️ **أسماء الخانات عقد مع الخادم**: `longDescription` و
 *    `galleryImageUrls` و`features` و`minAge`/`maxAge`. تغيير اسم
 *    هنا = الخادم يفتكر الخانة مش موجودة ويسيب القديم — **التعديل
 *    يضيع في صمت**.
 */
export function ProductContentFields({
  longDescription,
  galleryImageUrls,
  features,
  minAge,
  maxAge,
  library = false,
}: {
  longDescription?: string;
  galleryImageUrls?: string[];
  features?: string[];
  minAge?: number | null;
  maxAge?: number | null;
  /** زرار «من المكتبة» في المعرض — نموذجا الإدارة بس. */
  library?: boolean;
}) {
  const textareaClass =
    'w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-amber-500 focus:outline-none md:text-sm';

  return (
    <>
      <ProductAgeFields minAge={minAge} maxAge={maxAge} />

      {/* الوصف الكامل لصفحة المنتج — «الوصف» فوق سطر للكارت. */}
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          الوصف الكامل{' '}
          <span className="font-medium text-slate-500">
            (اختياري — بيظهر في صفحة المنتج)
          </span>
        </label>
        <textarea
          name="longDescription"
          defaultValue={longDescription ?? ''}
          rows={6}
          placeholder={'## عن القصة\nنصّ الفقرة…\n\n- نقطة\n- نقطة تانية'}
          className={textareaClass}
        ></textarea>
        <p className="mt-1 text-xs font-medium text-slate-500">
          يدعم <code>## عنوان</code> و<code>- نقطة</code> و<code>**عريض**</code>
          .
        </p>
      </div>

      <GalleryField
        name="galleryImageUrls"
        folder="alrehla/products/gallery"
        value={galleryImageUrls ?? []}
        library={library}
      />

      {/* **سطر لكل بند** عن قصد: أبسط شكل للكتابة بالعربي. والخادم
          بيشيل الفاضي والمكرّر ويسقّف عند ٨. */}
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          تفاصيل المنتج{' '}
          <span className="font-medium text-slate-500">
            (بند في كل سطر — اختياري)
          </span>
        </label>
        <textarea
          name="features"
          defaultValue={(features ?? []).join('\n')}
          rows={4}
          // ⚠️ المثال كان فيه «من ٤ لـ٨ سنين» — والسنّ بقى له خانة.
          //    السنّ المكتوب هنا بيظهر شريحة بس، **ومابيدخلش الفلتر**.
          placeholder={'٣٢ صفحة ملوّنة\nغلاف مقوّى\nتأليف: …'}
          className={textareaClass}
        ></textarea>
        <p className="mt-1 text-xs font-medium text-slate-500">
          أول بندين بيظهروا على الكارت، والباقي في صفحة المنتج. السنّ مكانه
          الخانة اللي فوق مش هنا.
        </p>
      </div>
    </>
  );
}
