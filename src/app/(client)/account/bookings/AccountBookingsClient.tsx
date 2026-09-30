'use client';

import React, { useState, useMemo } from 'react';
import { Search, Calendar, CheckCircle2, Clock, XCircle, AlertCircle, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { Pagination } from '@/components/dashboard/Pagination';

export interface BookingRow {
  id: string;
  referenceDisplay: string;
  sessionDisplay: string;
  dateDisplay: string;
  packageDisplay: string;
  status: string;
  rawScheduledAt: string;
  statusLabel: string;
  statusClass: string;
}

const PAGE_SIZE = 10;

export function AccountBookingsClient({ initialRows }: { initialRows: BookingRow[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Statistics
  const stats = useMemo(() => {
    const total = initialRows.length;
    const confirmed = initialRows.filter((r) => r.status === 'confirmed').length;
    const pending = initialRows.filter((r) => r.status === 'pending').length;
    const completed = initialRows.filter((r) => r.status === 'completed').length;
    return { total, confirmed, pending, completed };
  }, [initialRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRef = row.referenceDisplay.toLowerCase().includes(q);
        const matchPkg = row.packageDisplay.toLowerCase().includes(q);
        const matchSess = row.sessionDisplay.toLowerCase().includes(q);
        if (!matchRef && !matchPkg && !matchSess) return false;
      }
      return true;
    });
  }, [initialRows, search, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const handleFilterChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const columns = [
    { header: 'رقم الحجز', accessorKey: 'referenceDisplay' },
    { header: 'الجلسة', accessorKey: 'sessionDisplay' },
    { header: 'الموعد', accessorKey: 'dateDisplay' },
    { header: 'الباقة', accessorKey: 'packageDisplay' },
    {
      header: 'الحالة',
      accessorKey: 'statusDisplay',
      cell: (row: BookingRow) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.statusClass}`}>
          {row.statusLabel}
        </span>
      ),
    },
  ];

  const tableData = paginatedRows.map((r) => ({
    ...r,
    statusDisplay: (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${r.statusClass}`}>
        {r.statusLabel}
      </span>
    ),
  }));

  return (
    <div className="space-y-6">
      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <Layers className="h-4 w-4 text-slate-400" />
            <span>إجمالي الجلسات</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span>جلسات مؤكدة</span>
          </div>
          <div className="text-2xl font-black text-emerald-950">{stats.confirmed}</div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>بانتظار التثبيت</span>
          </div>
          <div className="text-2xl font-black text-amber-950">{stats.pending}</div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-blue-800 text-xs font-bold mb-1">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>جلسات مكتملة</span>
          </div>
          <div className="text-2xl font-black text-blue-950">{stats.completed}</div>
        </div>
      </div>

      {/* شريط الفلاتر والبحث لتسهيل استعراض المحتوى الكثيف */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث برقم الحجز، الباقة، أو الجلسة…"
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-10 pl-4 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-800 focus:outline-hidden transition-colors"
          />
        </div>

        {/* فلاتر الحالة */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'confirmed', label: 'مؤكدة' },
            { id: 'pending', label: 'بانتظار التثبيت' },
            { id: 'completed', label: 'مكتملة' },
            { id: 'cancelled', label: 'ملغاة' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilterChange(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* جدول الجلسات */}
      {tableData.length > 0 ? (
        <div className="space-y-4">
          <SimpleDataTable columns={columns} data={tableData} />

          {/* ترقيم الصفحات Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-2">
              <span className="text-xs text-slate-500 font-medium">
                عرض {paginatedRows.length} من أصل {filteredRows.length} جلسة
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 px-6 text-center">
          <Calendar className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-700 text-sm">لا توجد مواعيد تطابق خيارات البحث</h4>
          <p className="text-xs text-slate-400 mt-1">جرّب تغيير خيارات الفلترة أو مسح عبارة البحث.</p>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPage(1);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 text-xs transition-colors"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      )}
    </div>
  );
}
