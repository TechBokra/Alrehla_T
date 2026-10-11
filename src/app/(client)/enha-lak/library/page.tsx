import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'المكتبة العامة',
    description: 'تصفّح إصدارات دور النشر وكتب الأطفال المتاحة في مكتبة منصة الرحلة، واختار حسب سنّ طفلك.',
    path: '/enha-lak/library',
  });
}

import { BookOpen } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { ShelfHeader } from '@/components/enha-lak/ShelfHeader';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { LibraryClient } from './LibraryClient';
import { getSiteContent } from '@/data/domains/content';


export default async function LibraryPage() {
  const allProducts = await getPersonalizedProducts();
  const libraryProducts = allProducts.filter((p) => p.category === 'library');
  const [publishers, content] = await Promise.all([getPublishers(), getSiteContent()]);

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* ⚠️ **نفس رأس «أنت البطل هنا»** (`ShelfHeader`) — الطلب: المكتبة
          بنفس الشكل. والعنوان الفرعي من المصفوفة التنفيذية §3.3: «قصة
          جاهزة… وغلاف يحمل اسم طفلك» — أوضح فرق عن «أنت البطل هنا». */}
      <ShelfHeader
        title={content['library.title']}
        eyebrow={content['library.eyebrow']}
        icon={<BookOpen className="h-8 w-8" />}
        description={content['library.description']}
      />

      <LibraryClient
        initialProducts={libraryProducts}
        publishers={publishers}
        texts={{
          action: content['library.action'],
          details: content['library.details'],
          emptyTitle: content['library.empty.title'],
          emptyText: content['library.empty.text'],
        }}
      />
    </PageContainer>
  );
}
