'use client';

import React, { useEffect, useState } from 'react';
import { Checkbox, Field, Select, TextInput } from '@/components/forms/Form';
import { addWatermark, optimizedImageUrl } from '@/lib/cloudinary';
import {
  DEFAULT_WATERMARK_TEXT,
  WATERMARK_LOOKS,
  WATERMARK_OPACITIES,
  WATERMARK_POSITIONS,
  WATERMARK_SIZES,
  WATERMARK_STYLES,
  WATERMARK_TEXT_MAX,
  watermarkLayer,
  type WatermarkSettings,
} from '@/lib/watermark-settings';

/**
 * خانات العلامة المائية + **معاينة حيّة** على صورة من صور الموقع.
 *
 * المعاينة بتتبني بنفس الدالة اللي الصفحات العامة بتستعملها
 * (`watermarkLayer`)، فاللي بيظهر هنا هو اللي هيطلع على الموقع بعد الحفظ.
 *
 * ⚠️ الكتابة بتتحدّث في المعاينة بعد ما توقف كتابة نص ثانية: كل تغيير
 *    = صورة جديدة من Cloudinary، ومش محتاجين صورة لكل حرف.
 */
export function WatermarkFields({
  initial,
  sampleUrl,
}: {
  initial: WatermarkSettings;
  sampleUrl: string | null;
}) {
  const [value, setValue] = useState<WatermarkSettings>(initial);
  const [previewText, setPreviewText] = useState(initial.text);

  useEffect(() => {
    const t = setTimeout(() => setPreviewText(value.text), 600);
    return () => clearTimeout(t);
  }, [value.text]);

  const set = <K extends keyof WatermarkSettings>(key: K, v: WatermarkSettings[K]) =>
    setValue((prev) => ({ ...prev, [key]: v }));

  const layer = watermarkLayer({ ...value, text: previewText });
  const base = sampleUrl ? optimizedImageUrl(sampleUrl, 700) : '';
  const preview = base ? addWatermark(base, layer) : '';

  return (
    <>
      <Checkbox
        name="watermarkEnabled"
        label="حط العلامة على صور الموقع والمنتجات"
        hint="لو قفلتها، الصور بتظهر من غير علامة، وزرار «حمّل الصورة» في صفحة المنتج بيختفي (التحميل مسموح بالعلامة بس)."
        checked={value.enabled}
        onChange={(e) => set('enabled', e.target.checked)}
        className="md:col-span-2"
      />

      <Field
        label="الكتابة"
        name="watermarkText"
        hint={`لحد ${WATERMARK_TEXT_MAX} حرف. الحروف / و , و % بتتشال لأنها بتكسر رابط الصورة.`}
        className="md:col-span-2"
      >
        <TextInput
          maxLength={WATERMARK_TEXT_MAX}
          placeholder={DEFAULT_WATERMARK_TEXT}
          value={value.text}
          onChange={(e) => set('text', e.target.value)}
        />
      </Field>

      {/* ⚠️ **ده الاختيار اللي كان ناقص.** اللي كان موجود «بطاقة»
          وحدها — كتابة على خلفية مصمتة، وده ملصق فوق الصورة مش علامة
          مائية. */}
      <Field
        label="نوع العلامة"
        name="watermarkLook"
        hint="«علامة مائية» كتابة شفافة بتندمج في الصورة. «بطاقة» هي الشكل القديم."
        className="md:col-span-2"
      >
        <Select value={value.look} onChange={(e) => set('look', e.target.value as WatermarkSettings['look'])}>
          {WATERMARK_LOOKS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="درجة الوضوح" name="watermarkOpacity" hint="كل ما قلّت، كل ما كانت أقرب للعلامة المائية الحقيقية.">
        <Select
          value={value.opacity}
          onChange={(e) => set('opacity', e.target.value as WatermarkSettings['opacity'])}
        >
          {WATERMARK_OPACITIES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="اللون" name="watermarkStyle">
        <Select value={value.style} onChange={(e) => set('style', e.target.value as WatermarkSettings['style'])}>
          {WATERMARK_STYLES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="الحجم" name="watermarkSize">
        <Select value={value.size} onChange={(e) => set('size', e.target.value as WatermarkSettings['size'])}>
          {WATERMARK_SIZES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="المكان"
        name="watermarkPosition"
        hint="الأركان مش متاحة: خانات الموقع بتقص أطراف الصورة على حسب الشاشة، فالعلامة في الركن بتتقص."
        className="md:col-span-2"
      >
        <Select
          value={value.position}
          onChange={(e) => set('position', e.target.value as WatermarkSettings['position'])}
        >
          {WATERMARK_POSITIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <div className="md:col-span-2">
        <p className="mb-2 text-sm font-bold text-slate-700">المعاينة</p>
        {preview ? (
          <>
            {/* `<img>` مش `next/image`: المعاينة بتتغيّر مع كل اختيار. */}
            <img
              key={preview}
              src={preview}
              alt="معاينة العلامة المائية"
              className="aspect-[4/3] w-full max-w-md rounded-2xl border border-slate-200 object-cover"
              referrerPolicy="no-referrer"
            />
            {!value.enabled && (
              <p className="mt-2 text-xs font-bold text-amber-700">
                العلامة مقفولة — الصور بتظهر كده من غير علامة.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">
            ارفع صورة للصفحة الرئيسية من «صور الموقع» عشان تظهر المعاينة هنا.
          </p>
        )}
      </div>
    </>
  );
}
