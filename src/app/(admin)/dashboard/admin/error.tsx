'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh] px-6 text-center">
      <AlertTriangle className="h-20 w-20 text-red-400 mb-6" />
      <h2 className="text-2xl font-bold text-slate-800 mb-4">حدث خطأ غير متوقع</h2>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">
        نأسف لذلك، يبدو أن هناك مشكلة في تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
