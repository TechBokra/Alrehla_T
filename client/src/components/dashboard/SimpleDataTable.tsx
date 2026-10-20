'use client';

import React, { useState, useMemo } from 'react';
import { Inbox, Search, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';

export interface Column {
  header: string;
  accessorKey: string;
  /** Optional custom renderer. When present it wins over accessorKey. */
  cell?: (row: any) => React.ReactNode;
}

interface SimpleDataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  pageSize?: number;
  enableSearch?: boolean;
  enablePagination?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const renderCell = (col: Column, row: Record<string, any>): React.ReactNode =>
  col.cell ? col.cell(row) : row[col.accessorKey];

export function SimpleDataTable({
  columns,
  data = [],
  pageSize: initialPageSize = 10,
  enableSearch = true,
  enablePagination = true,
  searchPlaceholder = 'ابحث في السجلات...',
  emptyMessage = 'لا توجد بيانات للعرض حالياً.',
}: SimpleDataTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // فلترة البيانات بالبحث النصي عبر كافة الأعمدة
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    return data.filter((row) => {
      // البحث في جميع قيم السجل
      return Object.entries(row).some(([key, val]) => {
        if (val === null || val === undefined) return false;
        // استبعاد المكونات أو الدوال
        if (typeof val === 'object' && React.isValidElement(val)) return false;
        const str = String(val).toLowerCase();
        return str.includes(q);
      });
    });
  }, [data, searchQuery]);

  // حسابات الصفحات
  const shouldPaginate = enablePagination && (filteredData.length > pageSize || data.length > pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (!shouldPaginate) return filteredData;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, shouldPaginate, safeCurrentPage, pageSize]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Inbox className="h-16 w-16 opacity-50" />
        <p className="text-lg font-bold text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* شريط البحث وخيارات حجم الصفحة (يظهر عند تفعيل البحث أو عند كثرة البيانات) */}
      {(enableSearch && (data.length > 5 || searchQuery)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-xs md:text-sm font-medium outline-none transition-colors focus:border-amber-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                مسح
              </button>
            )}
          </div>

          {shouldPaginate && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span>عرض:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-bold text-slate-700 outline-none focus:border-amber-500 shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>سجل في الصفحة</span>
            </div>
          )}
        </div>
      )}

      {/* الحالة: لا توجد نتائج للبحث */}
      {filteredData.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Inbox className="mx-auto h-12 w-12 text-slate-300" />
          <p className="text-base font-bold text-slate-700">لا توجد نتائج تطابق بحثك</p>
          <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو امسح البحث للرجوع لجميع السجلات.</p>
          <button
            type="button"
            onClick={handleResetSearch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>عرض كل السجلات</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop View: Standard Table */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    {columns.map((col, index) => (
                      <th key={index} className="px-6 py-4 font-bold whitespace-nowrap">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50">
                      {columns.map((col, colIndex) => (
                        <td key={colIndex} className="px-6 py-4 font-medium text-slate-700">
                          {renderCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View: Stacked Cards */}
          <div className="flex flex-col gap-4 md:hidden">
            {paginatedData.map((row, rowIndex) => (
              <div key={rowIndex} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-col gap-3">
                  {columns.map((col, colIndex) => (
                    <div
                      key={colIndex}
                      className="flex justify-between gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-bold text-slate-500 shrink-0">{col.header}</span>
                      <span className="text-sm font-medium text-slate-800 text-left">
                        {renderCell(col, row)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* شريط الصفحات والتنقل (Pagination Bar) */}
      {shouldPaginate && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-600 shadow-2xs">
          <div>
            عرض {(safeCurrentPage - 1) * pageSize + 1} -{' '}
            {Math.min(safeCurrentPage * pageSize, filteredData.length)} من أصل{' '}
            {filteredData.length} سجل
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span>السابق</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1;
                })
                .map((pageNumber, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && pageNumber - prev > 1;

                  return (
                    <React.Fragment key={pageNumber}>
                      {hasGap && <span className="px-1 text-slate-400">…</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition-colors ${
                          safeCurrentPage === pageNumber
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
            >
              <span>التالي</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
