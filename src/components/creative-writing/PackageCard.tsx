import Link from 'next/link';
import { Target, Clock, Calendar, ArrowLeft } from 'lucide-react';
import type { WritingPackage } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DependentRequestButton } from '@/components/services/DependentRequestButton';

/** رابط صفحة تفاصيل الباقة — من مكان واحد عشان الكارت والصفحة مايفترقوش. */
export function packageHref(pkg: Pick<WritingPackage, 'slug' | 'id'>): string {
  return `/creative-writing/packages/${encodeURIComponent(pkg.slug || pkg.id)}`;
}

export function ageGroupLabel(ageGroup: WritingPackage['ageGroup']): string {
  return ageGroup === 'under_12' ? 'مناسبة لأقل من 12 سنة' : 'مناسبة لـ 12 سنة فأكثر';
}

/**
 * زرار الحجز — أو «اطلب من ولي أمرك» لحساب الطفل التابع.
 *
 * حساب الطفل التابع ممنوع من الحجز المباشر. من غير الزرار ده كان بيوصل
 * للمعالج ويكمّل لحد آخر خطوة وبعدين ياخد رسالة منع — طريق مسدود بعد
 * شغل. دلوقتي بيطلب من ولي أمره من هنا.
 */
export function PackageBookButton({
  pkg,
  isDependent,
  className = '',
}: {
  pkg: WritingPackage;
  isDependent: boolean;
  className?: string;
}) {
  if (isDependent) {
    return (
      <div className={className}>
        <DependentRequestButton kind="package" packageId={pkg.id} label="اطلب الباقة من ولي أمرك" />
      </div>
    );
  }
  return (
    <Button
      // الباقة بتتبعت في الرابط: قبل كده كان اللي بيختار باقة معيّنة
      // يوصل للمعالج وهو مختار أول باقة في القايمة.
      href={`/creative-writing/booking?package=${encodeURIComponent(pkg.id)}`}
      accentColor="emerald"
      className={`py-3 text-center ${className}`}
    >
      اكتشف المدربين والأسعار
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
    ...(pkg.sessionDuration
      ? [{ icon: Clock, label: 'مدة الجلسة', value: pkg.sessionDuration }]
      : []),
  ];
  const big = size === 'lg';
  return (
    <div className={`grid ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${big ? 'gap-4' : 'gap-2'}`}>
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className={`rounded-xl bg-slate-50 text-center ${big ? 'p-4' : 'px-2 py-2.5'}`}>
          <Icon className={`mx-auto text-slate-400 ${big ? 'mb-2 h-5 w-5' : 'mb-1 h-4 w-4'}`} />
          <div className="text-[11px] font-medium text-slate-500">{label}</div>
          <div className={`font-bold text-slate-800 ${big ? 'text-base' : 'text-xs'}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * كارت الباقة في صفحة الباقات — **مختصر**: الاسم والسن والوصف القصير
 * والأرقام، والتفاصيل كلها في صفحة الباقة.
 *
 * ⚠️ **كان فيه «لمن تناسب؟» و«ملاحظة» جوّه الكارت**، فالكارت طويل والكروت
 *    جنب بعض بأطوال مختلفة، و«الوصف القصير» المكتوب في اللوحة ماكانش
 *    بيظهر خالص. (ملاحظة فريق العمل: الوصف تحت الاسم والسن، والكارت أصغر،
 *    وصفحة تفاصيل فيها الوصف الكامل.)
 */
export function PackageCard({ pkg, isDependent }: { pkg: WritingPackage; isDependent: boolean }) {
  const href = packageHref(pkg);
  return (
    <Card accentColor="emerald" className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-800">
            <Link href={href} className="hover:text-emerald-700">
              {pkg.name}
            </Link>
          </h3>
          {/* الفئة العمرية توضيح للأهل، مش شرط بيتفحص: الباقة متاحة للحجز
              في كل الأحوال. */}
          <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {ageGroupLabel(pkg.ageGroup)}
          </span>
        </div>
        <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
          {formatPrice(pkg.price)}
        </div>
      </div>

      {pkg.shortDescription && (
        <p className="line-clamp-3 text-sm leading-relaxed font-medium text-slate-600">
          {pkg.shortDescription}
        </p>
      )}

      <PackageStats pkg={pkg} />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <PackageBookButton pkg={pkg} isDependent={isDependent} className="w-full" />
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          تفاصيل الباقة
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
