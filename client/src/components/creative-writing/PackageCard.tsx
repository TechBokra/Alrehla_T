import Link from 'next/link';
import Image from 'next/image';
import { Target, Clock, Calendar, ArrowLeft, Feather, Sparkles, PenTool } from 'lucide-react';
import type { PackageTrack, WritingPackage } from '@/types';
import { formatPrice } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { Button } from '@/components/ui/Button';
import { PackageInterestButton } from '@/components/creative-writing/PackageInterestButton';

/** رابط صفحة تفاصيل الباقة — من مكان واحد عشان الكارت والصفحة مايفترقوش. */
export function packageHref(pkg: Pick<WritingPackage, 'slug' | 'id'>): string {
  return `/creative-writing/packages/${encodeURIComponent(pkg.slug || pkg.id)}`;
}

export function ageGroupLabel(ageGroup: WritingPackage['ageGroup']): string {
  return ageGroup === 'under_12' ? 'مناسبة لأقل من 12 سنة' : 'مناسبة لـ 12 سنة فأكثر';
}

/**
 * ألوان كل مسار — عشان الأهل يفرّقوا بين المسارات بالعين قبل القراية.
 *
 * ⚠️ الكلاسات مكتوبة كاملة (مش `bg-${color}-50`) — Tailwind بيشيل أي
 *    كلاس مابيلاقيهوش مكتوب بالحرف في الكود.
 */
export const TRACK_STYLE: Record<
  PackageTrack | 'other',
  {
    icon: typeof Feather;
    /** خلفية الصورة الاحتياطية. */
    cover: string;
    iconColor: string;
    chip: string;
    accent: string;
    ring: string;
  }
> = {
  foundation: {
    icon: Feather,
    cover: 'bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100',
    iconColor: 'text-emerald-600/70',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    accent: 'bg-emerald-600',
    ring: 'hover:border-emerald-300',
  },
  youth: {
    icon: Sparkles,
    cover: 'bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50',
    iconColor: 'text-amber-600/70',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    accent: 'bg-amber-500',
    ring: 'hover:border-amber-300',
  },
  specialization: {
    icon: PenTool,
    cover: 'bg-gradient-to-br from-violet-100 via-indigo-50 to-violet-50',
    iconColor: 'text-violet-600/70',
    chip: 'bg-violet-50 text-violet-900 border-violet-200',
    accent: 'bg-violet-600',
    ring: 'hover:border-violet-300',
  },
  other: {
    icon: Feather,
    cover: 'bg-gradient-to-br from-slate-100 to-slate-50',
    iconColor: 'text-slate-500/70',
    chip: 'bg-slate-50 text-slate-700 border-slate-200',
    accent: 'bg-slate-600',
    ring: 'hover:border-slate-300',
  },
};

export function trackStyle(track: WritingPackage['track']) {
  return TRACK_STYLE[track ?? 'other'] ?? TRACK_STYLE.other;
}

/**
 * سعر الجلسة الواحدة — بيساعد الأهل يقارنوا الباقة القصيرة بالطويلة.
 * `null` لو عدد الجلسات مش مسجّل.
 */
export function perSessionPrice(pkg: Pick<WritingPackage, 'price' | 'sessionsCount'>): number | null {
  if (!pkg.sessionsCount || pkg.sessionsCount <= 0 || !pkg.price) return null;
  return Math.round(pkg.price / pkg.sessionsCount);
}

/**
 * صورة الباقة — أو خلفية المسار وأيقونته لو مفيش صورة.
 *
 * ⚠️ الاحتياطي **مقصود يبان كتصميم**، مش كصورة ناقصة: أغلب الباقات
 *    هتفضل من غير صورة لحد ما الإدارة ترفع، والصفحة لازم تبان كاملة.
 */
export function PackageCover({
  pkg,
  sizes,
  priority = false,
  className = '',
}: {
  pkg: WritingPackage;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const style = trackStyle(pkg.track);
  const Icon = style.icon;
  return (
    <div className={`relative w-full overflow-hidden ${style.cover} ${className}`}>
      {pkg.imageUrl ? (
        <Image
          src={optimizedImageUrl(pkg.imageUrl, 1200)}
          alt={pkg.name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-[var(--dur-ui)] motion-safe:group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Icon className={`h-20 w-20 ${style.iconColor}`} strokeWidth={1.25} />
          <span className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/40" />
          <span className="absolute -top-8 -right-4 h-24 w-24 rounded-full bg-white/30" />
        </div>
      )}
    </div>
  );
}

/**
 * زرار الحجز — أو «قريبًا + بلّغني» للباقة المقفولة.
 *
 * ⚠️ حساب الطفل التابع بيتوقف في صفحة الحجز (`booking/page.tsx`) وبيطلب
 *    من ولي أمره هناك — مش هنا، عشان الصفحة دي تفضل متخزّنة للكل.
 */
export function PackageBookButton({ pkg, className = '' }: { pkg: WritingPackage; className?: string }) {
  // باقة «قريبًا»: ظاهرة، والحجز مقفول (بند ٩). القاعدة كمان بترفض.
  if (pkg.bookingOpen === false) {
    return <PackageInterestButton packageId={pkg.id} className={className} />;
  }
  return (
    <Button
      // الباقة بتتبعت في الرابط: قبل كده كان اللي بيختار باقة معيّنة
      // يوصل للمعالج وهو مختار أول باقة في القايمة.
      href={`/creative-writing/booking?package=${encodeURIComponent(pkg.id)}`}
      accentColor="emerald"
      className={`py-3 text-center ${className}`}
    >
      اختار مدربك واحجز
    </Button>
  );
}

/** المدة · الجلسات · مدة الجلسة — صف صغير مشترك بين الكارت والصفحة. */
export function PackageStats({ pkg, size = 'sm' }: { pkg: WritingPackage; size?: 'sm' | 'lg' }) {
  const items = [
    // الخانة بتفضل ظاهرة حتى لو المدة مش متسجّلة، عشان الكروت ما تبقاش
    // مختلفة الشكل من باقة للتانية.
    { icon: Calendar, label: 'المدة', value: pkg.durationText || '—' },
    { icon: Target, label: 'الجلسات', value: `${pkg.sessionsCount} جلسة` },
    ...(pkg.sessionDuration ? [{ icon: Clock, label: 'مدة الجلسة', value: pkg.sessionDuration }] : []),
  ];
  const big = size === 'lg';
  return (
    <div className={`grid ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${big ? 'gap-3' : 'gap-2'}`}>
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className={`rounded-xl border border-slate-100 bg-slate-50/70 text-center ${big ? 'p-4' : 'px-2 py-3'}`}
        >
          <Icon className={`mx-auto text-slate-400 ${big ? 'mb-2 h-5 w-5' : 'mb-1 h-4 w-4'}`} aria-hidden="true" />
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className={`font-bold text-slate-800 ${big ? 'text-base' : 'text-sm'}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * كارت الباقة في صفحة الباقات (طلب تامر ٢٤ أكتوبر: «استعراض أحسن
 * بكتير» + صورة).
 *
 * كل مسار فيه باقتين (قصيرة وطويلة) جنب بعض، فالكارت مبني للمقارنة:
 * نفس الترتيب بالظبط في الاتنين، وسعر الجلسة الواحدة تحت السعر الكلي.
 *
 * ⚠️ الكارت كله مش لينك واحد عن قصد: فيه زرار «بلّغني» في الباقة
 *    المقفولة، وزرار جوّه لينك = HTML غلط وضغطتين في مكان واحد.
 */
export function PackageCard({ pkg }: { pkg: WritingPackage }) {
  const href = packageHref(pkg);
  const style = trackStyle(pkg.track);
  const perSession = perSessionPrice(pkg);
  const closed = pkg.bookingOpen === false;

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-[box-shadow,border-color,transform] duration-[var(--dur-ui)] ease-[var(--ease-ui)] hover:shadow-xl motion-safe:hover:-translate-y-1 ${style.ring}`}
    >
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <PackageCover pkg={pkg} sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[16/10]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          {pkg.durationText ? (
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-black text-slate-800 shadow-sm">
              {pkg.durationText}
            </span>
          ) : (
            <span />
          )}
          {closed && (
            <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">قريبًا</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-5 p-6 md:p-7">
        <div>
          <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${style.chip}`}>
            {ageGroupLabel(pkg.ageGroup)}
          </span>
          <h3 className="mt-3 text-2xl font-black text-slate-900">
            <Link href={href} className="hover:text-emerald-800 focus-visible:underline focus-visible:outline-none">
              {pkg.name}
            </Link>
          </h3>
          {pkg.shortDescription && (
            <p className="mt-2 text-base leading-relaxed font-medium text-slate-600">{pkg.shortDescription}</p>
          )}
        </div>

        <PackageStats pkg={pkg} />

        <div className="mt-auto space-y-4">
          <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <div className="text-xs font-bold text-slate-500">سعر الباقة</div>
              <div className="text-2xl font-black text-slate-900">{formatPrice(pkg.price)}</div>
            </div>
            {perSession !== null && (
              <div className="text-left text-xs font-bold text-slate-500">
                حوالي <span className="text-sm font-black text-slate-700">{formatPrice(perSession)}</span>
                <br />
                للجلسة
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <PackageBookButton pkg={pkg} className="w-full" />
            <Link
              href={href}
              /* ⚠️ `min-h-[44px]`: الحد اللي الموقع كله ماشي عليه للمس على الموبايل. */
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              تفاصيل الباقة
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
