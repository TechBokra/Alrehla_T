import type { Metadata } from 'next';
import { getSiteSettings } from '@/data/domains/content';
import { slotImageUrl, optimizedImageUrl } from '@/lib/cloudinary';

/**
 * عنوان الموقع — مصدر واحد للحقيقة.
 *
 * كان مكتوب في تلات ملفات بتلات قيم (`sitemap.ts` و`robots.ts` بعنوان،
 * و`layout.tsx` بعنوان تاني فيه شرطة زيادة). ده مش تفصيلة شكلية: العنوان ده
 * هو اللي بيتكتب في كل رابط قانوني (canonical) وفي كل صورة مشاركة وفي خريطة
 * الموقع. لو غلط، جوجل بيتفرّج على موقع مش موجود.
 *
 * الصح إن المتغير `NEXT_PUBLIC_SITE_URL` يتظبط في Vercel على الدومين الحقيقي،
 * والقيمة اللي تحت دي مجرد شبكة أمان لو المتغير مش موجود.
 */
// المصدر الواحد بقى `lib/site-url` (من غير استيرادات — الشاشات بتستعمله كمان).
import { SITE_URL } from '@/lib/site-url';
export { SITE_URL };

export function absoluteUrl(path = '/'): string {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** قصّ الوصف على الحد اللي جوجل بيعرضه، من غير ما يقطع كلمة في نصها. */
export function trimDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export interface PageSeo {
  title: string;
  description: string;
  /** المسار من غير الدومين، مثال: '/about' */
  path: string;
  /** صورة خاصة بالصفحة (غلاف منتج، صورة مقال). لو فاضية بنستخدم صورة الموقع. */
  image?: string;
  /** صفحات زي السلة والدفع: مفيش سبب تظهر في نتايج البحث. */
  noIndex?: boolean;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  /**
   * الافتراضي إن العنوان بيتحط جنبه اسم الموقع («عن المنصة · الرحلة»).
   * الصفحة الرئيسية بس هي اللي بتاخد عنوانها كامل من غير الإضافة دي.
   */
  titleAbsolute?: boolean;
}

/**
 * بيانات الصفحة لمحركات البحث ولمواقع التواصل.
 *
 * ليه محتاجين الدالة دي أصلًا؟ Next بيورّث بيانات الصفحة الرئيسية لكل
 * الصفحات. يعني لو الرئيسية كاتبة «الرابط القانوني ده هو الرئيسية»، كل صفحة
 * في الموقع بتقول لجوجل «أنا الرئيسية» — وجوجل ساعتها بيفهم إن الموقع كله
 * صفحة واحدة مكررة، فبيخفي الباقي. الدالة دي بتضمن إن كل صفحة تقول عنوانها
 * هي، ومعاها وصف ليها هي.
 */
export async function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex,
  type = 'website',
  publishedTime,
  titleAbsolute,
}: PageSeo): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || 'الرحلة';
  const url = absoluteUrl(path);
  const desc = trimDescription(description);

  const share = image
    ? optimizedImageUrl(image, 1200)
    : settings.images.ogImage
      ? slotImageUrl(settings.images.ogImage, 'ogImage')
      : undefined;

  return {
    title: titleAbsolute ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: type === 'profile' ? 'profile' : type,
      locale: 'ar_EG',
      siteName,
      title,
      description: desc,
      url,
      images: share ? [{ url: share, alt: title }] : undefined,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: share ? 'summary_large_image' : 'summary',
      title,
      description: desc,
      images: share ? [share] : undefined,
    },
  };
}
