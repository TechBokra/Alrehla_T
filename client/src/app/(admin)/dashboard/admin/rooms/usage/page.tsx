import React from 'react';
import Link from 'next/link';
import { Gauge, AlertTriangle, ExternalLink } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import {
  DAILY_FREE_MINUTES,
  DAILY_USD_PER_EXTRA_MINUTE,
  checkDailyKey,
  getUsageBetween,
  isDailyConfigured,
  monthBounds,
} from '@/lib/daily';
import { USAGE_STATUS_TEXT, usageForecast } from '@/lib/daily-usage';

export const dynamic = 'force-dynamic';

/**
 * تبويب «استهلاك القاعة» — كام دقيقة استهلكنا من Daily الشهر ده،
 * وفاضل كام للحد المجاني، وهنوصله إمتى.
 *
 * ── الطلب ───────────────────────────────────────────────────
 *
 * ملاحظة تامر (٢٤ أكتوبر). الأرقام كانت موجودة كمربع واحد في نص
 * صفحة «الغرف المباشرة» الطويلة؛ هنا ليها مكان لوحدها، ومعاها:
 * إمتى هنوصل للحد، والتكلفة المتوقعة بعده، ومقارنة بالشهرين اللي فاتوا.
 *
 * ⚠️ **مفتاح Daily مابيخرجش من الخادم.** الصفحة دي مكوّن خادم، والنداء
 *    بيتعمل من `lib/daily.ts` — المتصفح بيستلم أرقام بس.
 *
 * ⚠️ **الأرقام محسوبة من سجل الجلسات عند Daily**، مش من فاتورتهم.
 *    المفروض يتطابقوا، بس الفاتورة هي المرجع. فيه رابط للوحة Daily
 *    للمطابقة.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const header = (
    <DashboardPageHeader
      title="استهلاك القاعة (Daily)"
      backHref="/dashboard/admin/rooms"
    />
  );

  if (!isDailyConfigured()) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        {header}
        <Notice>
          مفتاح Daily مش متظبط على الخادم، فمش هنقدر نقرا الاستهلاك.
        </Notice>
      </div>
    );
  }

  const now = new Date();
  const months = [0, -1, -2].map((offset) => ({
    offset,
    ...monthBounds(now, offset),
  }));

  const [check, ...usages] = await Promise.all([
    checkDailyKey(),
    ...months.map((m) => getUsageBetween(m.start, m.end)),
  ]);

  if (!check.ok) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        {header}
        <Notice>{check.message}</Notice>
      </div>
    );
  }

  const current = usages[0];
  if (!current.ok) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        {header}
        <Notice>{current.error}</Notice>
      </div>
    );
  }

  const fc = usageForecast({
    used: current.data.participantMinutes,
    limit: DAILY_FREE_MINUTES,
    now,
    usdPerExtraMinute: DAILY_USD_PER_EXTRA_MINUTE,
  });

  const n = (x: number) => x.toLocaleString('ar-EG');
  const monthName = (start: number) =>
    new Date(start * 1000).toLocaleDateString('ar-EG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

  const barColor =
    fc.status === 'over' || fc.status === 'over_soon'
      ? 'bg-rose-500'
      : fc.status === 'watch'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const statusBox =
    fc.status === 'safe'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : fc.status === 'watch'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-rose-200 bg-rose-50 text-rose-900';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      {header}

      <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-800">
          <Gauge className="h-5 w-5 text-slate-400" />
          {monthName(months[0].start)}
        </h2>
        <p className="mb-6 text-sm font-medium text-slate-500">
          Daily بيحسب بـ«دقيقة المشارك»: جلسة نص ساعة فيها مدرب وطالب = ٦٠
          دقيقة، مش ٣٠. والعدّاد بيرجع صفر أول كل شهر.
        </p>

        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <span className="text-3xl font-black text-slate-800">
            {n(fc.used)}{' '}
            <span className="text-base font-bold text-slate-400">
              من {n(fc.limit)} دقيقة مجانية
            </span>
          </span>
          <span className="text-sm font-bold text-slate-500">
            {n(fc.rawPercent)}٪
          </span>
        </div>
        <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${fc.percent}%` }}
          />
        </div>

        <div
          className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${statusBox}`}
        >
          {USAGE_STATUS_TEXT[fc.status]}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="الباقي من المجاني" value={`${n(fc.remaining)} دقيقة`} />
          <Stat
            label="الأيام الباقية في الشهر"
            value={`${n(fc.daysLeft)} يوم`}
            hint={`عدّى ${n(fc.daysElapsed)} من ${n(fc.daysInMonth)}`}
          />
          <Stat label="المتوسط اليومي" value={`${n(fc.dailyAverage)} دقيقة`} />
          <Stat
            label="المتوقع آخر الشهر"
            value={`${n(fc.projected)} دقيقة`}
            hint="تقدير بالمعدّل الحالي"
          />
          <Stat
            label="الباقي يكفي"
            value={fc.daysOfRunway === null ? '—' : `${n(fc.daysOfRunway)} يوم`}
            hint="بالمعدّل الحالي"
          />
          <Stat
            label="هنوصل للحد يوم"
            value={
              fc.limitHitDay === null
                ? 'مش الشهر ده'
                : `${n(fc.limitHitDay)} ${monthName(months[0].start)}`
            }
          />
          <Stat
            label="تكلفة متوقعة بعد المجاني"
            value={
              fc.projectedExtraUsd > 0
                ? `$${fc.projectedExtraUsd.toFixed(2)}`
                : '٠'
            }
            hint={`$${DAILY_USD_PER_EXTRA_MINUTE} للدقيقة الزيادة — تقدير`}
          />
          <Stat
            label="جلسات الشهر"
            value={n(current.data.meetings)}
            hint={`أطول جلسة ${n(current.data.longestMeetingMinutes)} دقيقة`}
          />
        </div>

        {current.data.truncated && (
          <p className="mt-6 flex items-center gap-2 text-sm font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            الشهر فيه أكتر من ١٠٠٠ جلسة، فالرقم ده أقل من الحقيقي — راجع لوحة
            Daily.
          </p>
        )}
      </section>

      <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-800">
          الشهور اللي فاتت
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="text-xs font-bold text-slate-500">
              <tr>
                <th className="py-2">الشهر</th>
                <th className="py-2">الدقايق</th>
                <th className="py-2">من المجاني</th>
                <th className="py-2">الجلسات</th>
              </tr>
            </thead>
            <tbody className="font-bold text-slate-700">
              {months.map((m, i) => {
                const u = usages[i];
                return (
                  <tr key={m.offset} className="border-t border-slate-100">
                    <td className="py-3">
                      {monthName(m.start)}
                      {m.offset === 0 && (
                        <span className="mr-2 text-xs text-slate-400">
                          (لحد النهارده)
                        </span>
                      )}
                    </td>
                    {u.ok ? (
                      <>
                        <td className="py-3">{n(u.data.participantMinutes)}</td>
                        <td className="py-3">
                          {n(
                            Math.round(
                              (u.data.participantMinutes / DAILY_FREE_MINUTES) *
                                100
                            )
                          )}
                          ٪
                        </td>
                        <td className="py-3">{n(u.data.meetings)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="py-3 text-rose-600">
                        {u.error}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-4 text-sm font-bold">
        <a
          href="https://dashboard.daily.co/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
        >
          لوحة Daily (الفاتورة الرسمية) <ExternalLink className="h-4 w-4" />
        </a>
        <Link
          href="/dashboard/admin/rooms"
          prefetch={false}
          className="text-slate-600 hover:underline"
        >
          ← الغرف المباشرة
        </Link>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-800">{value}</p>
      {hint && (
        <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>
      )}
    </div>
  );
}
