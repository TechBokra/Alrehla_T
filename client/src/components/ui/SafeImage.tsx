import React from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { isAllowedImageHost } from '@/lib/image-hosts';

/**
 * صورة **مابتوقّعش الصفحة**.
 *
 * ── العطل اللي بتمنعه ───────────────────────────────────────
 *
 * `next/image` بيرمي على أي رابط من دومين مش في `remotePatterns`،
 * والرمي في صفحة سيرفر بيطلّع «حدث خطأ غير متوقع» للصفحة كلها. يعني
 * صورة واحدة من مصدر غريب — صورة حساب جوجل مثلًا — بتقفل شاشة إدارة
 * بالكامل، والإداري مش عارف سببها.
 *
 * ── اللي بيحصل بدل كده ──────────────────────────────────────
 *
 *   • رابط من دومين مسموح، أو رابط نسبي من عندنا → `next/image` عادي.
 *   • أي حاجة تانية → مكان الصورة بيعرض علامة + **رابط يفتحها**.
 *     مش بنخفيها في صمت: الإداري لازم يعرف إن فيه صورة مش بتتعرض،
 *     ويقدر يشوفها بنفسه ويقرّر.
 *
 * ⚠️ ومع إن سياسة `img-src` في الهيدرز بتمنع الدومينات الغريبة من
 *    التحميل أصلًا، فالرابط هو الطريق الوحيد الصادق — مش `<img>`
 *    هيطلع مكسور.
 */
export function SafeImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className = '',
  referrerPolicy,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  priority?: boolean;
}) {
  const value = (src ?? '').trim();
  const usable = value.startsWith('/') || isAllowedImageHost(value);

  if (!usable) {
    return (
      <span
        className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 p-2 text-center ${className}`}
      >
        <ImageOff className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <span className="text-[10px] font-bold leading-tight text-slate-500">
          {value ? 'صورة من مصدر خارجي' : 'مفيش صورة'}
        </span>
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-slate-700 underline"
          >
            افتحها ↗
          </a>
        )}
      </span>
    );
  }

  return (
    <Image
      src={value}
      alt={alt}
      {...(fill ? { fill: true } : { width: width ?? 400, height: height ?? 400 })}
      sizes={sizes}
      className={className}
      referrerPolicy={referrerPolicy}
      priority={priority}
    />
  );
}
