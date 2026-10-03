'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * نماذج الخدمة (ملف 09) — شبكة صور، والضغط بيكبّر في `<dialog>`.
 *
 * ⚠️ `<dialog>` الأصلي مش مكتبة: بيقفل بـEsc، وبيحبس التركيز جوّاه، وبيرجّعه
 *    للصورة لما يتقفل — نفس اختيار معرض صور المنتج.
 */
export function ServiceSamples({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (images.length === 0) return null;

  const open = (i: number) => {
    setActive(i);
    dialogRef.current?.showModal();
  };
  const step = (d: number) => setActive((i) => (i + d + images.length) % images.length);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`كبّر النموذج ${(i + 1).toLocaleString('ar-EG')}`}
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
            >
              <Image
                src={src}
                alt={`${alt} — نموذج ${(i + 1).toLocaleString('ar-EG')}`}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform motion-safe:hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,960px)] rounded-3xl bg-white p-0 backdrop:bg-slate-900/80"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          <Image
            src={images[active]}
            alt={`${alt} — نموذج ${(active + 1).toLocaleString('ar-EG')}`}
            fill
            sizes="92vw"
            className="object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center justify-between gap-2 p-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-4 font-bold text-slate-700 hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> إغلاق
          </button>
          {images.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="السابق"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="text-sm font-bold text-slate-600">
                {(active + 1).toLocaleString('ar-EG')} / {images.length.toLocaleString('ar-EG')}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="التالي"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
