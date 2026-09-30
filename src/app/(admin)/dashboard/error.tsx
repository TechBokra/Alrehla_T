'use client';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">حدث خطأ في لوحة التحكم</h2>
        <p className="mt-2 text-sm text-slate-600">حاول تحديث الصفحة أو العودة مرة أخرى.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
