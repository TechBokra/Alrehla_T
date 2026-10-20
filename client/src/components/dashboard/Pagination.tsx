'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * تقسيم الجداول على صفحات.
 *
 * يدعم الاستدعاء الكامل بحجم الصفحة والإجمالي، أو الاستدعاء البسيط بعدد الصفحات الكلي.
 */
export function Pagination({
  page,
  pageSize = 25,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const pageCount = totalPages ?? (total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1);
  const showSummary = total !== undefined && onPageSizeChange !== undefined;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total ?? 0);

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
      {showSummary && (
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <span>
            {total === 0 ? 'لا توجد نتائج' : `${from}–${to} من ${total}`}
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} في الصفحة
              </option>
            ))}
          </select>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <span className="px-2 text-sm font-bold text-slate-700">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
