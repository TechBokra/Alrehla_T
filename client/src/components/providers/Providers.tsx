'use client';
import { CartProvider } from '@/context/CartContext';
import { ReactNode } from 'react';
import { PaidCartSweeper } from '@/components/checkout/PaidCartSweeper';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {/* ⚠️ منع «حفظ الصورة» (`ImageGuard`) اتشال — قرار تامر 3 أكتوبر:
          الصور اللي الأهل بيشاركوها ترويج ببلاش، والعلامة المائية عليها.
          والمنع ماكانش بيمنع لقطة الشاشة أصلًا. */}
      {children}
      {/* بنود الطلبات اللي اتدفعت بتتشال من السلة في أي صفحة (٢٤ أكتوبر). */}
      <PaidCartSweeper />
    </CartProvider>
  );
}
