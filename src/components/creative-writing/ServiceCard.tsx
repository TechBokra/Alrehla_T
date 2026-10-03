import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileEdit,
  Headphones,
  MessageCircle,
  Sparkles,
  Video,
  PenLine,
  CreditCard,
  PackageCheck,
  type LucideIcon,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { deliveryLabel } from '@/lib/service-details';

/**
 * شكل التصنيف (أيقونة ولون) — **العرض بس**؛ الخدمات نفسها من القاعدة.
 * التصنيف الجديد اللي مش هنا بياخد الشكل الافتراضي ومابيختفيش.
 */
const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tint: string; text: string }> = {
  'مراجعات': { icon: FileEdit, tint: 'bg-blue-50', text: 'text-blue-700' },
  'قصص فيديو': { icon: Video, tint: 'bg-purple-50', text: 'text-purple-700' },
  'نشر': { icon: BookOpen, tint: 'bg-emerald-50', text: 'text-emerald-700' },
  'استشارات': { icon: MessageCircle, tint: 'bg-amber-50', text: 'text-amber-800' },
  'قصص مسموعة': { icon: Headphones, tint: 'bg-rose-50', text: 'text-rose-700' },
};
const DEFAULT_STYLE = { icon: Sparkles, tint: 'bg-slate-50', text: 'text-slate-700' };

export function categoryStyle(category: string | undefined) {
  return (category && CATEGORY_STYLE[category]) || DEFAULT_STYLE;
}

export function serviceHref(id: string) {
  return `/creative-writing/services/${encodeURIComponent(id)}`;
}

export type ServiceCardData = {
  id: string;
  name: string;
  description: string;
  category?: string;
  /** السعر اللي العميل بيدفعه — من أرخص مقدّم معتمد (`getProvidersForService`). */
  price: number;
  /** «يبدأ من»: أكتر من مقدّم بأسعار مختلفة، أو الخدمة نفسها «يبدأ من». */
  startsFrom: boolean;
  deliveryDays?: number;
  /** متعلّمة بالعلامة المائية من الصفحة. */
  imageUrl?: string;
  /** مفيش مقدّم معتمد = «قريبًا» ومش بتتطلب. */
  available: boolean;
};

/**
 * كارت الخدمة في صفحة الخدمات الإبداعية — **الكارت كله رابط** لصفحة الخدمة.
 *
 * ⚠️ كانت كروت نص من غير صورة، والسعر بخط ٣xl هو أكبر حاجة فيها، وزرار
 *    «اطلب الآن» بيودّي للدفع على طول من غير ما العميل يعرف هياخد إيه.
 *    (ملاحظة تامر: «أضعف جزء في الموقع».) الطلب بقى من صفحة الخدمة.
 */
export function ServiceCard({ service }: { service: ServiceCardData }) {
  const style = categoryStyle(service.category);
  const Icon = style.icon;
  const delivery = deliveryLabel(service.deliveryDays);

  return (
    <Link
      href={serviceHref(service.id)}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-[box-shadow,transform] duration-[var(--dur-ui)] ease-[var(--ease-ui)] hover:shadow-lg motion-safe:hover:-translate-y-1"
    >
      <div className={`relative aspect-[4/3] w-full overflow-hidden ${style.tint}`}>
        {service.imageUrl ? (
          <Image
            src={service.imageUrl}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[var(--dur-ui)] motion-safe:group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className={`h-16 w-16 ${style.text} opacity-60`} aria-hidden="true" />
          </div>
        )}
        {service.category && (
          <span className={`absolute top-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold shadow-sm ${style.text}`}>
            {service.category}
          </span>
        )}
        {!service.available && (
          <span className="absolute top-3 left-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-bold text-white">
            قريبًا
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-xl font-black text-slate-800 group-hover:text-emerald-800">{service.name}</h3>
        {service.description && (
          <p className="line-clamp-2 text-sm leading-relaxed font-medium text-slate-600">
            {service.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-4">
          <div>
            {service.startsFrom && <span className="block text-xs font-bold text-slate-500">يبدأ من</span>}
            <span className="text-xl font-black text-slate-900">{formatPrice(service.price)}</span>
          </div>
          {delivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {delivery}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800">
          {service.available ? 'التفاصيل والطلب' : 'التفاصيل'}
          <ArrowLeft className="h-4 w-4 transition-transform motion-safe:group-hover:-translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/** «إزاي بتشتغل» — تلات خطوات، في صفحة الخدمات وصفحة كل خدمة. */
export function ServiceSteps({ compact = false }: { compact?: boolean }) {
  const steps = [
    { icon: PenLine, title: 'اختار الخدمة واكتب تفاصيلك', text: 'قولنا عايز إيه بالظبط ولمين.' },
    { icon: CreditCard, title: 'ادفع بالتحويل', text: 'إنستاباي أو فودافون كاش، وارفع صورة الإيصال.' },
    { icon: PackageCheck, title: 'استلم في حسابك', text: 'الشغل والرسايل في «طلباتي»، وتقدر تسأل في أي وقت.' },
  ];
  return (
    <ol className={`grid gap-4 ${compact ? '' : 'md:grid-cols-3'}`}>
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <s.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-black text-slate-800">
              {(i + 1).toLocaleString('ar-EG')}. {s.title}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
