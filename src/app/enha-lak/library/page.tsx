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


export default async function LibraryPage() {
  const allProducts = await getPersonalizedProducts();
  const libraryProducts = allProducts.filter((p) => p.category === 'library');
  const publishers = await getPublishers();

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* ⚠️ **نفس رأس «أنت البطل هنا»** (`ShelfHeader`) — الطلب: المكتبة
          بنفس الشكل. والعنوان الفرعي من المصفوفة التنفيذية §3.3: «قصة
          جاهزة… وغلاف يحمل اسم طفلك» — أوضح فرق عن «أنت البطل هنا». */}
      <ShelfHeader
        title="المكتبة العامة"
        eyebrow="قصة جاهزة… وغلاف يحمل اسم طفلك"
        icon={<BookOpen className="h-8 w-8" />}
        description="تصفّح القصص واختار اللي يناسب طفلك. محتوى القصة يفضل زي ما هو، والتخصيص على الغلاف والخيارات المتاحة بس."
      />

      <LibraryClient initialProducts={libraryProducts} publishers={publishers} />
    </PageContainer>
  );
}
