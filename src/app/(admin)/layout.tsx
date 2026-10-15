import type { ReactNode } from 'react';
import Header from '@/components/layout/Header';

/**
 * هيدر الموقع (الشعار + القائمة + السلة + الحساب) فوق **كل** لوحات التحكم:
 * الإدارة والمدرب والناشر والمزوّد والطالب. كان موجود في الموقع العام بس،
 * ولوحات التحكم كلها من غيره.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <Header />
      {children}
    </div>
  );
}
