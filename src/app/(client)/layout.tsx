import type { ReactNode } from 'react';
import Header from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import { FloatingActions } from '@/components/layout/FloatingActions';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-500 z-50" />
      <AnnouncementBar />
      <Header />
      <main className="relative flex w-full flex-1 flex-col">{children}</main>
      <Footer />
      <FloatingActions />
    </>
  );
}
