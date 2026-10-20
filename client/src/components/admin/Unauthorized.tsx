import React from 'react';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="bg-red-50 p-6 rounded-full text-red-500 mb-6">
        <ShieldAlert className="h-12 w-12" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">غير مصرح لك بالوصول لهذا القسم</h2>
      <p className="text-slate-500 font-medium mb-6">عذراً، صلاحياتك الحالية لا تسمح لك بالوصول إلى هذه الصفحة.</p>
      <Link href="/dashboard/admin" className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800">
        العودة للوحة الإدارة
      </Link>
    </div>
  );
}
