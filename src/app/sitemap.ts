import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getBlogPosts } from '@/data/domains/(shared)/content/blog';
import { getAddonProducts } from '@/data/domains/(shared)/products/addons';
import { getPersonalizedProducts } from '@/data/domains/(client)/products/queries';
import { getPublishers } from '@/data/domains/(shared)/publishers/queries';
import { getVisibleInstructors } from '@/data/domains/(shared)/instructors/public';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { getStandaloneServices } from '@/data/domains/(shared)/services/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { aqlamNavVisible } from '@/lib/aqlam/settings';
import { listIndexablePostIds } from '@/data/domains/(shared)/aqlam/queries';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Static routes
  const staticRoutes = [
    '',
    '/about',
    '/blog',
    '/enha-lak',
    '/enha-lak/custom',
    '/enha-lak/library',
    '/enha-lak/subscription',
    '/creative-writing',
    '/creative-writing/about',
    '/creative-writing/instructors',
    '/creative-writing/packages',
    '/creative-writing/services',
    '/join-us',
    '/support',
    '/privacy',
    '/terms'
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic routes
  const posts = await getBlogPosts();
  const blogRoutes = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const allProducts = await getPersonalizedProducts();
  const platformProducts = allProducts.filter((p: any) => p.ownerType === 'platform');
  const productRoutes = platformProducts.map((product: any) => ({
    url: `${baseUrl}/enha-lak/product/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // صفحات تفاصيل الإضافات (ملف 19).
  const addonRoutes = (await getAddonProducts()).map((addon) => ({
    url: `${baseUrl}/enha-lak/addon/${addon.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const publishers = await getPublishers();
  const publisherRoutes = publishers.map((pub: any) => ({
    url: `${baseUrl}/enha-lak/publisher/${pub.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // خريطة الموقع بتتبعت لجوجل — المخفي والموقوف مالهمش مكان فيها.
  const instructors = await getVisibleInstructors();
  const instructorRoutes = instructors.map((inst: any) => ({
    url: `${baseUrl}/creative-writing/instructors/${inst.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // صفحة تفاصيل كل باقة (الرابط نفسه من `packageHref` في الكارت).
  const packages = await getWritingPackages();
  const packageRoutes = packages
    .filter((p) => p.isActive)
    .map((p) => ({
      url: `${baseUrl}/creative-writing/packages/${encodeURIComponent(p.slug || p.id)}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

  // صفحة كل خدمة إبداعية (ملف 09).
  const services = await getStandaloneServices();
  const serviceRoutes = services.map((sv) => ({
    url: `${baseUrl}/creative-writing/services/${encodeURIComponent(sv.id)}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // أقلام الرحلة: بس لما الوضع «عام». والنصوص المسموح بفهرستها فقط (١٢+ وإذن الكاتب).
  // لو القراءة فشلت، الخريطة تكمل من غيرها — مش هنوقّع الـsitemap كله.
  let aqlamRoutes: MetadataRoute.Sitemap = [];
  try {
    if (aqlamNavVisible((await getSiteSettings()).aqlam)) {
      const ids = await listIndexablePostIds();
      aqlamRoutes = [
        { url: `${baseUrl}/aqlam`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
        ...ids.map((p) => ({
          url: `${baseUrl}/aqlam/p/${p.id}`,
          lastModified: new Date(p.publishedAt || new Date()),
          changeFrequency: 'monthly' as const,
          priority: 0.5,
        })),
      ];
    }
  } catch (error) {
    console.error('sitemap: aqlam routes skipped', error);
  }

  return [
    ...staticRoutes,
    ...aqlamRoutes,
    ...packageRoutes,
    ...serviceRoutes,
    ...blogRoutes,
    ...productRoutes,
    ...addonRoutes,
    ...publisherRoutes,
    ...instructorRoutes,
  ];
}
