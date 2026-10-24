import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { formatPrice } from '@/lib/utils';
import { addonCustomerPrice } from '@/lib/item-format';
import type { AddonProduct } from '@/types';

/**
 * كارت الإضافة — **بنفس شكل كارت المنتج** (`ProductCard`) عن قصد.
 *
 * ملاحظة تامر (10 أكتوبر): «الإضافات المفروض تتبع نفس أسلوب العرض…
 * اللي بيفرّقها بس إنها مش بتتطلب لوحدها». كانت كروت نص من غير صورة.
 *
 * ⚠️ **مفيش زرار «أضف للسلة» ولا «ابدأ التخصيص» هنا**: الإضافة مش منتج
 *    يتباع لوحده (دالة الطلب بترفض الطلب كله لو إضافة لوحدها في السلة)،
 *    وهي بتتختار جوّه تخصيص القصة. فالكارت كله رابط لصفحة التفاصيل،
 *    وتحت السعر سطر بيقول ده بوضوح.
 */
export function AddonCard({ addon, badge }: { addon: AddonProduct; badge: string }) {
  const href = `/enha-lak/addon/${addon.slug}`;

  return (
    <Card
      accentColor="rose"
      interactive
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border-2 p-0 hover:shadow-xl hover:shadow-rose-500/10"
    >
      <Link href={href} aria-label={addon.name} className="absolute inset-0 z-0" />

      {/* نفس لوح الغلاف: `contain` مابتقصّش، والنسبة 4/5 زي القصص. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-b from-rose-50 via-white to-slate-50">
        {addon.imageUrl ? (
          <Image
            src={optimizedImageUrl(addon.imageUrl, 600)}
            alt={addon.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px"
            className="object-contain p-6 drop-shadow-lg transition-transform duration-[var(--dur-slow)] ease-[var(--ease-ui)] motion-safe:group-hover:scale-[1.04]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImagePlaceholder label={addon.name} />
        )}

        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          باسم الطفل وصورته
        </span>
      </div>

      <div className="z-10 flex flex-1 flex-col p-5">
        <h3 className="pointer-events-none mb-1 text-xl leading-snug font-bold text-slate-800">
          {addon.name}
        </h3>

        {addon.description && (
          <p className="pointer-events-none mb-3 line-clamp-2 text-sm leading-relaxed font-medium text-slate-600">
            {addon.description}
          </p>
        )}

        {addon.features && addon.features.length > 0 && (
          <ul className="pointer-events-none mb-3 flex flex-wrap gap-1.5">
            {addon.features.slice(0, 2).map((feature, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-600"
              >
                {feature}
              </li>
            ))}
            {addon.features.length > 2 && (
              <li className="px-1 py-0.5 text-xs font-bold text-slate-500">
                +{addon.features.length - 2}
              </li>
            )}
          </ul>
        )}

        <div className="pointer-events-none mt-auto mb-4 border-t border-slate-100 pt-4">
          <span className="block text-xs font-bold tracking-wide text-slate-500">
            {badge}
          </span>
          {/* شامل التخصيص — نفس الرقم اللي في خطوة الإضافات. */}
          <span className="text-enha-lak-strong text-2xl font-black">
            {formatPrice(addonCustomerPrice(addon))}
          </span>
        </div>

        <Link
          href={href}
          className="group/details text-enha-lak-strong pointer-events-auto relative z-20 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-rose-100 text-sm font-bold transition-colors hover:border-rose-300"
        >
          عرض التفاصيل
          <ArrowLeft className="h-4 w-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-ui)] motion-safe:group-hover/details:-translate-x-1" />
        </Link>
      </div>
    </Card>
  );
}
