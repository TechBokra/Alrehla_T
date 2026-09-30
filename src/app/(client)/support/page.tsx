import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import SupportClient from './SupportClient';
import { getCurrentUser } from '@/data/domains/auth';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الدعم والمساعدة',
    description: 'تواصل مع فريق الدعم الفني لحل أي مشكلة أو للإجابة على استفساراتك.',
    path: '/support',
  });
}

export default async function SupportPage() {
  const user = await getCurrentUser();
  return <SupportClient isSignedIn={user.role !== 'visitor'} />;
}
