import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';

/**
 * لوحة مقدّم الخدمة.
 *
 * شاشة واحدة بس (الطلبات)، فمفيش شريط تبويبات — شريط بتبويبة واحدة
 * مساحة ضايعة. اللي هنا هو التحقق من الدور في مكان واحد بدل ما يتكرر
 * في كل صفحة وينسى في واحدة.
 *
 * بيشتغل للمستقل وللمدرب: المدرب ليه لوحته كمان، والاتنين بيوصلوا لنفس
 * الطلبات.
 */
export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'service_provider' && user.role !== 'instructor') {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
