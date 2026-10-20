import { absoluteUrl, trimDescription } from '@/lib/seo';

/**
 * بناء البيانات المنظّمة (schema.org) اللي بتتحط في الصفحات.
 *
 * كل دالة هنا بتبني كائن واحد بيتعرض بمكوّن <JsonLd />. القاعدة اللي ماشيين
 * عليها: **ما نكتبش لجوجل غير اللي في قاعدة البيانات فعلًا**. تقييم من غير
 * تقييمات حقيقية أو سعر من غير سعر بيتحسب غش، وجوجل بيعاقب عليه الموقع كله.
 */

type Json = Record<string, unknown>;

/** يشيل المفاتيح الفاضية عشان ما نبعتش لجوجل حقول ناقصة. */
function compact(obj: Json): Json {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export function organizationSchema({
  name,
  description,
  logo,
  email,
  sameAs,
}: {
  name: string;
  description: string;
  logo?: string;
  email?: string;
  sameAs?: (string | undefined)[];
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${absoluteUrl('/')}#organization`,
    name,
    url: absoluteUrl('/'),
    description: trimDescription(description, 300),
    logo,
    email,
    sameAs: (sameAs ?? []).filter(Boolean).length
      ? (sameAs ?? []).filter(Boolean)
      : undefined,
  });
}

export function websiteSchema({ name }: { name: string }): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name,
    url: absoluteUrl('/'),
    inLanguage: 'ar',
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
  };
}

export function productSchema({
  name,
  description,
  image,
  path,
  price,
  currency = 'EGP',
  brand,
}: {
  name: string;
  description?: string;
  image?: string;
  path: string;
  price?: number;
  currency?: string;
  brand?: string;
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description ? trimDescription(description, 300) : undefined,
    image: image || undefined,
    url: absoluteUrl(path),
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    // السعر بيتكتب بس لو موجود فعلًا. عرض «متاح» من غير سعر بيترفض.
    offers:
      typeof price === 'number' && price > 0
        ? {
            '@type': 'Offer',
            price: String(price),
            priceCurrency: currency,
            availability: 'https://schema.org/InStock',
            url: absoluteUrl(path),
          }
        : undefined,
  });
}

export function articleSchema({
  title,
  description,
  image,
  path,
  publishedAt,
  author,
  siteName,
}: {
  title: string;
  description?: string;
  image?: string;
  path: string;
  publishedAt?: string;
  author?: string;
  siteName: string;
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: trimDescription(title, 110),
    description: description ? trimDescription(description, 300) : undefined,
    image: image || undefined,
    mainEntityOfPage: absoluteUrl(path),
    datePublished: publishedAt || undefined,
    dateModified: publishedAt || undefined,
    inLanguage: 'ar',
    author: author ? { '@type': 'Person', name: author } : { '@type': 'Organization', name: siteName },
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
  });
}

export function instructorSchema({
  name,
  description,
  image,
  path,
  rating,
  ratingCount,
}: {
  name: string;
  description?: string;
  image?: string;
  path: string;
  rating?: number | null;
  ratingCount?: number;
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: description ? trimDescription(description, 300) : undefined,
    image: image || undefined,
    url: absoluteUrl(path),
    jobTitle: 'مدرب كتابة إبداعية',
    worksFor: { '@id': `${absoluteUrl('/')}#organization` },
    // التقييم بيتكتب بس لو فيه تقييمات حقيقية في قاعدة البيانات.
    aggregateRating:
      typeof rating === 'number' && (ratingCount ?? 0) > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: rating.toFixed(1),
            reviewCount: ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  });
}

/** مسار التنقّل اللي جوجل بيعرضه فوق الرابط بدل العنوان الطويل. */
export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
