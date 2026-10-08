import React from 'react';
import { GalleryField } from '@/components/dashboard/GalleryField';
import { ProductAgeFields } from '@/components/dashboard/ProductAgeFields';
import { Field, TextArea } from '@/components/forms/Form';

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
  return (
    <>
      <ProductAgeFields minAge={minAge} maxAge={maxAge} />

      {/* الوصف الكامل لصفحة المنتج — «الوصف» فوق سطر للكارت. */}
      <Field
        label="الوصف الكامل"
        name="longDescription"
        hint={
          <>
            اختياري — بيظهر في صفحة المنتج. يدعم <code>## عنوان</code> و
            <code>- نقطة</code> و<code>**عريض**</code>.
          </>
        }
      >
        <TextArea
          defaultValue={longDescription ?? ''}
          rows={6}
          placeholder={'## عن القصة\nنصّ الفقرة…\n\n- نقطة\n- نقطة تانية'}
        />
      </Field>

      <GalleryField
        name="galleryImageUrls"
        folder="alrehla/products/gallery"
        value={galleryImageUrls ?? []}
        library={library}
      />

      {/* **سطر لكل بند** عن قصد: أبسط شكل للكتابة بالعربي. والخادم
          بيشيل الفاضي والمكرّر ويسقّف عند ٨. */}
      <Field
        label="تفاصيل المنتج"
        name="features"
        hint="اختياري — بند في كل سطر. أول بندين بيظهروا على الكارت، والباقي في صفحة المنتج. السنّ مكانه الخانة اللي فوق مش هنا."
      >
        <TextArea
          defaultValue={(features ?? []).join('\n')}
          rows={4}
          // ⚠️ المثال كان فيه «من ٤ لـ٨ سنين» — والسنّ بقى له خانة.
          //    السنّ المكتوب هنا بيظهر شريحة بس، **ومابيدخلش الفلتر**.
          placeholder={'٣٢ صفحة ملوّنة\nغلاف مقوّى\nتأليف: …'}
        />
      </Field>
    </>
  );
}
