'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { optimizedImageUrl } from '@/lib/cloudinary';

/**
 * معرض صور المنتج — الغلاف ومعاه صور إضافية.
 *
 * ── ليه مكوّن عميل صغير ─────────────────────────────────────
 *
 * صفحة المنتج **صفحة خادم** عن قصد (بتتخزّن مؤقتًا وبتفتح أسرع).
 * اللي محتاج متصفح هنا حاجة واحدة: أي صورة مختارة. فالمكوّن ده
 * صغير ومعزول، والصفحة بتفضل خادمًا.
 *
 * ── وقواعد العرض ────────────────────────────────────────────
 *
 * ⚠️ **`object-contain` لا `cover`** — زيّ الكارت وصفحة التفاصيل:
 *    دي أغلفة كتب وصفحات، وقصّها بيشيل العنوان أو نصّ الصفحة.
 *
 * ⚠️ **والشريط مابيظهرش لو فيه صورة واحدة**: شريط بصورة واحدة
 *    بيوعد بصور تانية مش موجودة، والزائر بيدوّر عليها.
 *
 * ⚠️ **والأزرار أزرار حقيقية** (`<button>`) لا `div` بـ`onClick`:
 *    اللي بيتنقّل بالكيبورد لازم يوصلها، واللي بقارئ شاشة لازم
 *    يعرف إنها قابلة للضغط وأنهي واحدة مختارة (`aria-current`).
 *
 * ── والتكبير (٣٠ سبتمبر) ────────────────────────────────────
 *
 * الصورة في الصفحة بعرض ~٢٦٠ بكسل على الموبايل — وصفحة من جوّه كتاب
 * أطفال مابتتقريش بالحجم ده. الضغط عليها بيفتحها بملء الشاشة.
 *
 * ⚠️ **`<dialog>` الأصلي لا `div` فوق الصفحة**: `showModal()` بيحبس
 *    التنقّل بالكيبورد جوّه النافذة، و`Esc` بيقفلها، والتركيز بيرجع
 *    للزرار اللي فتحها — كل ده من المتصفح نفسه. الـ`div` كان محتاج
 *    يتكتب له التلاتة، وأي واحد ينقص بيحبس اللي بيستعمل كيبورد.
 */
export function ProductGallery({
  images,
  alt,
}: {
  /** الغلاف أولًا، وبعده الصور الإضافية. */
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];
  const dialogRef = useRef<HTMLDialogElement>(null);

  const step = (delta: number) =>
    setActive((i) => (i + delta + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-[2rem] border-2 border-rose-100 bg-gradient-to-b from-rose-50 via-white to-amber-50 shadow-lg sm:max-w-xs lg:max-w-none">
        {current && (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label="كبّر الصورة"
            className="group absolute inset-0 z-10 cursor-zoom-in"
          >
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              كبّر
            </span>
          </button>
        )}
        {current ? (
          <Image
            // ⚠️ `key` عشان المتصفح يبدّل الصورة فعلًا: من غيرها
            //    `next/image` ممكن يسيب القديمة ظاهرة لحد ما
            //    الجديدة تحمّل، فالضغطة تبان إنها ما عملتش حاجة.
            key={current}
            src={optimizedImageUrl(current, 900)}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 280px, 520px"
            priority={active === 0}
            className="object-contain p-5 drop-shadow-lg"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImagePlaceholder label={alt} />
        )}
      </div>

      {images.length > 1 && (
        <div
          className="hide-scrollbar mx-auto flex max-w-[260px] gap-2 overflow-x-auto sm:max-w-xs lg:max-w-none"
          role="group"
          aria-label="صور المنتج"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-current={i === active ? 'true' : undefined}
              aria-label={`صورة ${i + 1} من ${images.length}`}
              className={
                'relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-[border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-ui)] ' +
                (i === active
                  ? 'border-enha-lak-border'
                  : 'border-slate-200 motion-safe:hover:-translate-y-0.5')
              }
            >
              <Image
                src={optimizedImageUrl(src, 160)}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      )}

      {current && (
        <dialog
          ref={dialogRef}
          aria-label={`${alt} — صورة ${active + 1} من ${images.length}`}
          // الضغط على الخلفية المعتمة بيقفل — الهدف هو الـdialog نفسه
          // لما الضغطة برّه المحتوى.
          onClick={(e) => {
            if (e.target === e.currentTarget) dialogRef.current?.close();
          }}
          onKeyDown={(e) => {
            // ⚠️ في العربي «التالي» ناحية الشمال: السهم الشمال بيقدّم.
            if (e.key === 'ArrowLeft') step(1);
            if (e.key === 'ArrowRight') step(-1);
          }}
          className="m-auto h-[92vh] max-h-none w-[94vw] max-w-4xl rounded-3xl bg-white p-0 backdrop:bg-slate-900/80"
        >
          <div className="relative h-full w-full">
            <Image
              key={`zoom-${current}`}
              src={optimizedImageUrl(current, 1600)}
              alt={alt}
              fill
              sizes="94vw"
              className="object-contain p-4 md:p-8"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="اقفل"
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-md"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="الصورة اللي قبلها"
                  className="absolute top-1/2 right-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow-md ring-1 ring-slate-200"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="الصورة اللي بعدها"
                  className="absolute top-1/2 left-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow-md ring-1 ring-slate-200"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  {(active + 1).toLocaleString('ar-EG')} / {images.length.toLocaleString('ar-EG')}
                </p>
              </>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
