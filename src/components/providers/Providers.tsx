'use client';
import { CartProvider } from '@/context/CartContext';
import { ReactNode } from 'react';
import { ImageGuard } from '@/components/providers/ImageGuard';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {/* منع «حفظ الصورة» في الموقع كله — ردع لا حماية (`lib/image-guard.ts`). */}
      <ImageGuard />
      {children}
    </CartProvider>
  );
}
