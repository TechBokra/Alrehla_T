import React from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <SearchX className="h-24 w-24 text-slate-300 mb-6" />
      <h1 className="text-4xl font-black text-slate-900 mb-4">404 - الصفحة غير موجودة</h1>
      <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
        يبدو أن الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <Link href="/" className="rounded-xl bg-slate-900 px-8 py-4 font-bold text-white transition-colors hover:bg-slate-800">
        العودة للصفحة الرئيسية
      </Link>
    </div>
  );
}
