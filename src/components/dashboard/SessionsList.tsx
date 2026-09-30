'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Clock, Video, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export type SessionRow = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  scheduledAt: string;
  status: string;
  meetingUrl?: string;
};

interface SessionsListProps {
  sessions: SessionRow[];
  pageSize?: number;
  enableSearch?: boolean;
  enablePagination?: boolean;
}

const STATUS: Record<string, { label: string; type: StatusBadgeType }> = {
  confirmed: { label: 'مؤكدة', type: 'success' },
  pending: { label: 'بانتظار التأكيد', type: 'pending' },
  completed: { label: 'تمّت', type: 'neutral' },
  cancelled: { label: 'ملغاة', type: 'neutral' },
};

export function SessionsList({
  sessions,
  pageSize = 10,
  enableSearch = true,
  enablePagination = true,
}: SessionsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const now = Date.now();
  const todayStr = new Date().toDateString();

  // فلترة بالبحث
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter((s) => {
      const title = (s.title || '').toLowerCase();
      const sub = (s.subtitle || '').toLowerCase();
      return title.includes(q) || sub.includes(q);
    });
  }, [sessions, searchQuery]);

  // تقسيم لصفحات
  const shouldPaginate = enablePagination && filtered.length > pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedSessions = useMemo(() => {
    if (!shouldPaginate) return filtered;
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, shouldPaginate, safeCurrentPage, pageSize]);

  if (sessions.length === 0) {
    return (
      <p className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">
        مفيش جلسات مسجّلة.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* شريط البحث إن كان عدد الجلسات كبيراً */}
      {enableSearch && sessions.length > 5 && (
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="ابحث في الجلسات..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-xs md:text-sm font-medium outline-none transition-colors focus:border-amber-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              مسح
            </button>
          )}
        </div>
      )}

      {/* قائمة الجلسات */}
      {displayedSessions.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
          لا توجد جلسات تطابق البحث.
        </p>
      ) : (
        <div className="space-y-3">
          {displayedSessions.map((session) => {
            const date = new Date(session.scheduledAt);
            const isToday = todayStr === date.toDateString();
            const past = date.getTime() < now;
            const badge = STATUS[session.status] ?? { label: session.status, type: 'neutral' as const };

            return (
              <div
                key={session.id}
                className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 md:flex-row md:items-center ${
                  isToday ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${
                      isToday
                        ? 'bg-amber-500 text-white shadow-xs'
                        : past
                        ? 'border border-slate-200 bg-slate-50 text-slate-400'
                        : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-xs">
                      {date.toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE, month: 'short' })}
                    </span>
                    <span className="text-lg leading-none">{date.getDate()}</span>
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{session.title}</p>
                    {session.subtitle && (
                      <p className="truncate text-sm font-medium text-slate-500">
                        {session.subtitle}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {date.toLocaleTimeString('ar-EG', {
                          timeZone: PLATFORM_TIMEZONE,
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <StatusBadge type={badge.type} label={badge.label} />
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 items-center gap-3 md:w-auto">
                  {session.meetingUrl && !past && (
                    <a
                      href={session.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-slate-800 md:flex-none shadow-xs"
                    >
                      <Video className="h-4 w-4" />
                      دخول الجلسة
                    </a>
                  )}
                  <Link
                    href={session.href}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-center text-sm font-bold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-50 shadow-2xs"
                  >
                    التفاصيل
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* أزرار الصفحات (Pagination) */}
      {shouldPaginate && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-600 shadow-2xs">
          <span>
            عرض {(safeCurrentPage - 1) * pageSize + 1} -{' '}
            {Math.min(safeCurrentPage * pageSize, filtered.length)} من أصل {filtered.length}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span>السابق</span>
            </button>

            <span className="px-2">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
