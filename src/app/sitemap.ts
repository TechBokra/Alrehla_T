import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getBlogPosts } from '@/data/domains/content';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { getPublicInstructors, getWritingPackages } from '@/data/domains/writing';
import { getStandaloneServices } from '@/data/domains/services';

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

  const publishers = await getPublishers();
  const publisherRoutes = publishers.map((pub: any) => ({
    url: `${baseUrl}/enha-lak/publisher/${pub.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const instructors = await getPublicInstructors();
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

  return [
    ...staticRoutes,
    ...packageRoutes,
    ...serviceRoutes,
    ...blogRoutes,
    ...productRoutes,
    ...publisherRoutes,
    ...instructorRoutes,
  ];
}
