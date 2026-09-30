'use client';

import React, { useState } from 'react';
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

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-rose-50 via-white to-slate-50 shadow-lg sm:max-w-xs lg:max-w-none">
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
    </div>
  );
}
