import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'المكتبة العامة',
    description: 'تصفّح إصدارات دور النشر وكتب الأطفال المتاحة في مكتبة منصة الرحلة.',
    path: '/enha-lak/library',
  });
}

import { BookOpen } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { getPersonalizedProducts, getPublishers } from '@/data/domains/products';
import { LibraryClient } from './LibraryClient';


export default async function LibraryPage() {
  const allProducts = await getPersonalizedProducts();
  const libraryProducts = allProducts.filter((p) => p.category === 'library');
  const publishers = await getPublishers();

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <div className="relative">
        <SectionHeader
          title="المكتبة العامة"
          icon={<BookOpen className="h-8 w-8" />}
          iconClassName="bg-rose-50 text-rose-600"
          description="اختر قصة جاهزة من المكتبة وخصص غلافها فقط، محتوى القصة الأصلي يبقى كما هو. خيار مثالي لمن يبحث عن محتوى قيم بلمسة شخصية بسيطة."
        />

      </div>

      {/* Library Products with Filters */}
      <LibraryClient initialProducts={libraryProducts} publishers={publishers} />


    </PageContainer>
  );
}

