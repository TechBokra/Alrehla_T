import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/account/',
        '/cart/',
        '/checkout/',
        '/enha-lak/checkout/',
        '/enha-lak/order-confirmation/',
        '/creative-writing/booking/',
        '/sign-in/',
        '/sign-up/',
        '/notifications/'
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
