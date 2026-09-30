'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { InstructorSession } from '@/types';
import {
  Calendar,
  Clock,
  Video,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Hourglass,
  Layers,
  User,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

interface Props {
  sessions: InstructorSession[];
}

type StatusFilter = 'all' | 'upcoming' | 'today' | 'completed' | 'pending' | 'cancelled' | 'past';
type SortOption = 'closest' | 'newest' | 'oldest';

const STATUS_CONFIG: Record<
  string,
  { label: string; type: 'success' | 'warning' | 'neutral' }
> = {
  confirmed: { label: 'مؤكدة', type: 'success' },
  pending: { label: 'بانتظار التأكيد', type: 'warning' },
  completed: { label: 'مكتملة', type: 'neutral' },
  cancelled: { label: 'ملغاة', type: 'neutral' },
};

export function InstructorSessionsClient({ sessions }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('closest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const now = Date.now();
  const todayDateString = new Date().toDateString();

  // استخراج قائمة الباقات الفريدة للفلترة
  const availablePackages = useMemo(() => {
    const pkgs = new Set<string>();
    sessions.forEach((s) => {
      if (s.packageName) pkgs.add(s.packageName);
    });
    return Array.from(pkgs);
  }, [sessions]);

  // إحصائيات سريعة في أعلى الصفحة
  const stats = useMemo(() => {
    let upcomingCount = 0;
    let todayCount = 0;
    let completedCount = 0;
    let pendingCount = 0;

    sessions.forEach((s) => {
      const time = new Date(s.scheduledAt).getTime();
      const isToday = new Date(s.scheduledAt).toDateString() === todayDateString;
      if (isToday) todayCount++;
      if (time >= now && s.status !== 'cancelled' && s.status !== 'completed') {
        upcomingCount++;
      }
      if (s.status === 'completed') completedCount++;
      if (s.status === 'pending') pendingCount++;
    });

    return {
      total: sessions.length,
      upcoming: upcomingCount,
      today: todayCount,
      completed: completedCount,
      pending: pendingCount,
    };
  }, [sessions, now, todayDateString]);

  // فلترة وترتيب الجلسات في الذاكرة لأقصى سرعة
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => {
        const sessionTime = new Date(session.scheduledAt).getTime();
        const isToday = new Date(session.scheduledAt).toDateString() === todayDateString;

        // فلترة الحالة
        if (statusFilter === 'upcoming') {
          if (sessionTime < now || session.status === 'cancelled') return false;
        } else if (statusFilter === 'today') {
          if (!isToday) return false;
        } else if (statusFilter === 'completed') {
          if (session.status !== 'completed') return false;
        } else if (statusFilter === 'pending') {
          if (session.status !== 'pending') return false;
        } else if (statusFilter === 'cancelled') {
          if (session.status !== 'cancelled') return false;
        } else if (statusFilter === 'past') {
          if (sessionTime >= now) return false;
        }

        // فلترة الباقة
        if (packageFilter !== 'all' && session.packageName !== packageFilter) {
          return false;
        }

        // فلترة البحث النصي
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const pName = (session.participantName || '').toLowerCase();
          const pkgName = (session.packageName || '').toLowerCase();
          const sessionNum = `جلسة ${session.sessionNumber}`.toLowerCase();
          const numOnly = String(session.sessionNumber);

          const matches =
            pName.includes(q) ||
            pkgName.includes(q) ||
            sessionNum.includes(q) ||
            numOnly === q;

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.scheduledAt).getTime();
        const timeB = new Date(b.scheduledAt).getTime();

        if (sortBy === 'closest') {
          // الأقرب لموعد الآن
          const diffA = Math.abs(timeA - now);
          const diffB = Math.abs(timeB - now);
          return diffA - diffB;
        } else if (sortBy === 'newest') {
          return timeB - timeA;
        } else {
          return timeA - timeB;
        }
      });
  }, [sessions, statusFilter, packageFilter, searchQuery, sortBy, now, todayDateString]);

  // الحسابات الخاصة بالصفحات (Pagination)
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedSessions = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, safeCurrentPage, pageSize]);

  // عند تغيير أي فلتر، نعيد الصفحة للأولى
  const handleFilterChange = (setter: () => void) => {
    setter();
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPackageFilter('all');
    setSortBy('closest');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    packageFilter !== 'all' ||
    sortBy !== 'closest';

  return (
    <div className="space-y-6">
      {/* 1. بطاقات الإحصاءات السريعة في أعلى الصفحة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        <div
          onClick={() => handleFilterChange(() => setStatusFilter('all'))}
          className={`cursor-pointer rounded-3xl border p-4 transition-all shadow-xs ${
            statusFilter === 'all'
              ? 'border-slate-800 bg-slate-900 text-white'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">إجمالي الجلسات</span>
            <Layers className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 text-2xl font-black">{stats.total}</div>
        </div>

        <div
          onClick={() => handleFilterChange(() => setStatusFilter('upcoming'))}
          className={`cursor-pointer rounded-3xl border p-4 transition-all shadow-xs ${
            statusFilter === 'upcoming'
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 text-amber-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">القادمة</span>
            <Calendar className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 text-2xl font-black">{stats.upcoming}</div>
        </div>

        <div
          onClick={() => handleFilterChange(() => setStatusFilter('today'))}
          className={`cursor-pointer rounded-3xl border p-4 transition-all shadow-xs ${
            statusFilter === 'today'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60 text-emerald-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">جلسات اليوم</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 text-2xl font-black">{stats.today}</div>
        </div>

        <div
          onClick={() => handleFilterChange(() => setStatusFilter('completed'))}
          className={`cursor-pointer rounded-3xl border p-4 transition-all shadow-xs ${
            statusFilter === 'completed'
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">المكتملة</span>
            <CheckCircle2 className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 text-2xl font-black">{stats.completed}</div>
        </div>
      </div>

      {/* 2. شريط البحث والفلترة والتحكم بالصفحات */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
        {/* أزرار التبويب الرئيسية للحالة */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-4 text-xs font-bold">
          {(
            [
              { key: 'all' as StatusFilter, label: 'الكل', count: stats.total },
              { key: 'upcoming' as StatusFilter, label: 'القادمة', count: stats.upcoming },
              { key: 'today' as StatusFilter, label: 'اليوم', count: stats.today },
              { key: 'completed' as StatusFilter, label: 'المكتملة', count: stats.completed },
              { key: 'pending' as StatusFilter, label: 'بانتظار التأكيد', count: stats.pending },
              { key: 'past' as StatusFilter, label: 'السابقة', count: undefined },
              { key: 'cancelled' as StatusFilter, label: 'الملغاة', count: undefined },
            ]
          ).map((tab) => {
            const isSelected = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFilterChange(() => setStatusFilter(tab.key))}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* حقل البحث والقوائم المنسدلة للفلترة والترتيب */}
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-12">
          {/* حقل البحث السريع */}
          <div className="relative md:col-span-5">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleFilterChange(() => setSearchQuery(e.target.value))}
              placeholder="ابحث باسم المتدرب، الباقة، أو رقم الجلسة..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-xs md:text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleFilterChange(() => setSearchQuery(''))}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                مسح
              </button>
            )}
          </div>

          {/* فلتر الباقة */}
          {availablePackages.length > 0 && (
            <div className="md:col-span-3">
              <select
                value={packageFilter}
                onChange={(e) => handleFilterChange(() => setPackageFilter(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
              >
                <option value="all">جميع الباقات ({availablePackages.length})</option>
                {availablePackages.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ترتيب النتائج */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
            >
              <option value="closest">الأقرب موعداً</option>
              <option value="newest">الأحدث تاريخاً</option>
              <option value="oldest">الأقدم تاريخاً</option>
            </select>
          </div>

          {/* حجم الصفحة */}
          <div className="md:col-span-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
            >
              <option value={10}>10 في الصفحة</option>
              <option value={20}>20 في الصفحة</option>
              <option value={50}>50 في الصفحة</option>
            </select>
          </div>
        </div>

        {/* شريط النتائج وزر إعادة الضبط */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500 font-medium border-t border-slate-100">
          <div>
            إجمالي النتائج المطابقة:{' '}
            <strong className="text-slate-800 font-black">{filteredSessions.length}</strong> جلسة
            {filteredSessions.length > 0 && (
              <span className="mr-2 text-slate-400">
                (صفحة {safeCurrentPage} من {totalPages})
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800"
            >
              <RotateCcw className="h-3 w-3" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. قائمة الجلسات المقسمة لصفحات */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">لا توجد جلسات تطابق خياراتك</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            لم نجد أي جلسات مسجلة تطابق الحالة أو البحث المحدد. يمكنك تغيير الفلاتر أو إعادة ضبطها.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors mt-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إظهار جميع الجلسات</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedSessions.map((session) => {
            const date = new Date(session.scheduledAt);
            const isToday = todayDateString === date.toDateString();
            const isPast = date.getTime() < now;
            const badge = STATUS_CONFIG[session.status] ?? {
              label: session.status,
              type: 'neutral' as const,
            };

            return (
              <div
                key={session.id}
                className={`flex flex-col justify-between gap-4 rounded-3xl border p-4 sm:p-5 transition-all md:flex-row md:items-center ${
                  isToday
                    ? 'border-amber-300 bg-amber-50/70 shadow-xs'
                    : isPast
                    ? 'border-slate-200 bg-slate-50/70'
                    : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                {/* تفاصيل الموعد واسم الجلسة والمتدرب */}
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  {/* شارة التاريخ اليوم / الشهر */}
                  <div
                    className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl font-bold ${
                      isToday
                        ? 'bg-amber-500 text-white shadow-xs'
                        : isPast
                        ? 'border border-slate-200 bg-slate-100 text-slate-500'
                        : 'border border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">
                      {date.toLocaleDateString('ar-EG', {
                        timeZone: PLATFORM_TIMEZONE,
                        month: 'short',
                      })}
                    </span>
                    <span className="text-xl font-black leading-none">{date.getDate()}</span>
                    {isToday && (
                      <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
                        اليوم
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/instructor/sessions/${session.id}`}
                        className="font-black text-slate-800 text-base hover:text-amber-700 transition-colors"
                      >
                        جلسة {session.sessionNumber} مع {session.participantName}
                      </Link>
                      <StatusBadge type={badge.type} label={badge.label} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        {date.toLocaleTimeString('ar-EG', {
                          timeZone: PLATFORM_TIMEZONE,
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {session.packageName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600">{session.packageName}</span>
                        </>
                      )}

                      {session.studentRef && (
                        <>
                          <span>•</span>
                          <Link
                            href={`/dashboard/instructor/students/${session.studentRef}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <User className="h-3 w-3" />
                            <span>ملف المتدرب</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* أزرار الإجراءات السريعة */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end">
                  {session.meetingUrl && !isPast && session.status !== 'cancelled' && (
                    <a
                      href={session.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 shadow-xs"
                    >
                      <Video className="h-4 w-4" />
                      <span>دخول الجلسة</span>
                    </a>
                  )}

                  <Link
                    href={`/dashboard/instructor/sessions/${session.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                  >
                    <span>تفاصيل الجلسة</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. شريط أرقام الصفحات والتنقل (Pagination Bar) */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-600">
            عرض {(safeCurrentPage - 1) * pageSize + 1} -{' '}
            {Math.min(safeCurrentPage * pageSize, filteredSessions.length)} من أصل{' '}
            {filteredSessions.length} جلسة
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
            >
              <ChevronRight className="h-4 w-4" />
              <span>السابق</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // عرض الصفحات القريبة من الصفحة الحالية فقط
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
                        className={`h-8 w-8 rounded-xl text-xs font-bold transition-colors ${
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
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
            >
              <span>التالي</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
