import React from 'react';
import { getCurrentUser } from '@/data/domains/auth';
import {
  getInstructorSessions,
  getWritingPackages,
  getPublicInstructorById,
  getInstructorById,
  getProfileUpdateRequestsByInstructor,
} from '@/data/domains/writing';
import { getMyInstructorId } from '@/data/domains/services';
import { getInstructorRatingSummary, getReviewsForInstructor } from '@/data/domains/reviews';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Calendar,
  Video,
  Clock,
  Wallet,
  User,
  Settings,
  Sparkles,
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  Star,
  Layers,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InstructorDashboard() {
  const user = await getCurrentUser();

  if (user.role !== 'instructor') {
    redirect('/dashboard');
  }

  const instructorId = await getMyInstructorId();

  const [allBookings, instructor, publicRow, updateRequests, allPackages, ratingSummary, reviews] =
    await Promise.all([
      getInstructorSessions(),
      instructorId ? getInstructorById(instructorId) : null,
      instructorId ? getPublicInstructorById(instructorId) : null,
      instructorId ? getProfileUpdateRequestsByInstructor(instructorId) : [],
      getWritingPackages(),
      instructorId ? getInstructorRatingSummary(instructorId) : { average: null, count: 0 },
      instructorId ? getReviewsForInstructor(instructorId) : [],
    ]);

  // الجلسات القادمة غير الملغاة وغير المنتهية
  const confirmedBookings = allBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'completed'
  );

  // الترتيب حسب الأقرب موعداً أولاً
  const upcomingSessions = [...confirmedBookings].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // جلسات اليوم
  const todayStr = new Date().toDateString();
  const todaySessions = allBookings.filter(
    (b) => new Date(b.scheduledAt).toDateString() === todayStr && b.status !== 'cancelled'
  );

  // أقرب جلسة قادمة للعرض البارز
  const nextSession = upcomingSessions[0] || null;

  // عدد الطلاب الحاليين المختلفين
  const uniqueStudents = new Set(allBookings.map((b) => b.studentRef)).size;

  // معاينة لعدد محدود من الجلسات القادمة (أحدث 3 جلسات فقط)
  const previewSessions = upcomingSessions.slice(0, 3);

  // الطلبات المعلقة قيد المراجعة لدى الإدارة
  const pendingRequests = updateRequests.filter((r) => r.status === 'pending');

  // الباقات المعتمدة للمدرب
  const approvedPackageIds = publicRow?.packageIds || [];
  const approvedPackages = allPackages.filter((p) => approvedPackageIds.includes(p.id));

  // أحدث تقييم للمعاينة
  const latestReview = reviews[0] || null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* 1. الترويسة المدمجة + شارات نظام العمل والحالة */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                مرحباً أستاذ(ة)، {user.fullName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                نشط
              </span>
            </div>
            
            {/* تفاصيل العمل المختصرة */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">نظام العمل:</span>
                <span className="font-medium text-slate-800">
                  {instructor?.workModel === 'monthly'
                    ? `راتب شهري (${instructor.monthlyHoursCommitted || 60} ساعة)`
                    : `بالجلسة (${instructor?.approvedPrice ? `${instructor.approvedPrice} ج.م` : 'سعر معتمد'})`}
                </span>
              </div>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">الباقات المعتمدة:</span>
                <span className="font-medium text-slate-800">
                  {approvedPackages.length > 0 ? `${approvedPackages.length} باقة` : 'جميع الباقات'}
                </span>
              </div>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">المواعيد الأسبوعية:</span>
                <span className="font-medium text-slate-800">
                  {instructor?.weeklySchedule?.length || 0} موعد متاح
                </span>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/dashboard/instructor/sessions"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-amber-700"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>جدول الجلسات</span>
            </Link>
            <Link
              href="/dashboard/instructor/settings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              <span>إعدادات العمل</span>
            </Link>
            <Link
              href="/dashboard/instructor/payouts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Wallet className="h-3.5 w-3.5 text-slate-500" />
              <span>المستحقات</span>
            </Link>
          </div>
        </div>

        {/* تنبيه الطلب المعلق إن وجد */}
        {pendingRequests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50/70 p-3.5 border border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-amber-900">
                  لديك {pendingRequests.length} طلب تعديل معلق قيد مراجعة الإدارة:
                </span>{' '}
                <span className="text-amber-800">
                  {pendingRequests.map((r, i) => (
                    <span key={r.id}>
                      {(r.requestedChanges as any)._requestType === 'packages'
                        ? 'طلب باقات تدريب'
                        : 'طلب تعديل الجدول والملف'}
                      {i < pendingRequests.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/instructor/settings"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 underline shrink-0"
            >
              <span>متابعة الطلبات</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* 2. بطاقات الإحصاءات الموجزة المدمجة (Stats Grid) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        <Link
          href="/dashboard/instructor/sessions"
          className={`group rounded-2xl border p-4 shadow-2xs transition-all hover:shadow-xs ${
            todaySessions.length > 0
              ? 'border-emerald-300 bg-emerald-50/60 hover:border-emerald-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">جلسات اليوم</span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                todaySessions.length > 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{todaySessions.length}</div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-500">
            {todaySessions.length > 0 ? 'مواعيد مجدولة اليوم' : 'لا توجد جلسات اليوم'}
          </div>
        </Link>

        <Link
          href="/dashboard/instructor/sessions"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الجلسات القادمة</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{confirmedBookings.length}</div>
          <div className="mt-0.5 text-[11px] font-bold text-blue-700">عرض الجدول الكامل</div>
        </Link>

        <Link
          href="/dashboard/instructor/students"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-amber-300 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">المتدربون</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{uniqueStudents}</div>
          <div className="mt-0.5 text-[11px] font-bold text-amber-700">متابعة ملفات الطلاب</div>
        </Link>

        <Link
          href="/dashboard/instructor/ratings"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-purple-300 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">التقييم العام</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {ratingSummary.average != null ? ratingSummary.average.toFixed(1) : '—'}
            </span>
            <span className="text-xs font-medium text-slate-400">/ 5.0</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-purple-700">
            {ratingSummary.count > 0 ? `${ratingSummary.count} تقييم مسجل` : 'لا توجد تقييمات بعد'}
          </div>
        </Link>
      </div>

      {/* 3. تنبيه الجلسة القادمة مباشرة (Spotlight Bar) إن وجدت */}
      {nextSession && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-amber-600 text-white font-bold shadow-2xs">
              <span className="text-[10px] font-semibold leading-tight">
                {new Date(nextSession.scheduledAt).toLocaleDateString('ar-EG', {
                  timeZone: PLATFORM_TIMEZONE,
                  month: 'short',
                })}
              </span>
              <span className="text-base font-black leading-none">
                {new Date(nextSession.scheduledAt).getDate()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-0.5">
                <Clock className="h-3 w-3" />
                <span>جلستك القادمة مباشرة</span>
              </div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                جلسة {nextSession.sessionNumber} مع {nextSession.participantName}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {nextSession.packageName} • الساعة{' '}
                {new Date(nextSession.scheduledAt).toLocaleTimeString('ar-EG', {
                  timeZone: PLATFORM_TIMEZONE,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200">
            {nextSession.meetingUrl && (
              <a
                href={nextSession.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <Video className="h-3.5 w-3.5" />
                <span>دخول الجلسة</span>
              </a>
            )}
            <Link
              href={`/dashboard/instructor/sessions/${nextSession.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>تفاصيل الجلسة</span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. محتوى منظم ومتوازن: الجلسات والباقات + التقييمات والإدارة السريعة */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* العمود الرئيسي (2 أعمدة): أقرب الجلسات + الباقات المعتمدة */}
        <div className="lg:col-span-2 space-y-6">
          {/* قسم أقرب الجلسات */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-amber-600" />
                <h2 className="font-black text-slate-800 text-base">أقرب الجلسات القادمة</h2>
              </div>
              <Link
                href="/dashboard/instructor/sessions"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800"
              >
                <span>فتح صفحة الجلسات الكاملة</span>
                <ChevronLeft className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {previewSessions.map((session) => {
                const date = new Date(session.scheduledAt);
                const isToday = todayStr === date.toDateString();

                return (
                  <div
                    key={session.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border p-3 transition-colors ${
                      isToday
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${
                          isToday
                            ? 'bg-amber-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <span className="text-[9px] leading-tight">
                          {date.toLocaleDateString('ar-EG', {
                            timeZone: PLATFORM_TIMEZONE,
                            month: 'short',
                          })}
                        </span>
                        <span className="text-sm font-black leading-none">{date.getDate()}</span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                          جلسة {session.sessionNumber} مع {session.participantName}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {date.toLocaleTimeString('ar-EG', {
                              timeZone: PLATFORM_TIMEZONE,
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span className="truncate">{session.packageName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Link
                        href={`/dashboard/instructor/sessions/${session.id}`}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                      >
                        تفاصيل
                      </Link>
                      <Link
                        href={`/dashboard/instructor/students/${session.studentRef}`}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-2xs"
                      >
                        ملف الطالب
                      </Link>
                    </div>
                  </div>
                );
              })}

              {previewSessions.length === 0 && (
                <div className="py-6 text-center text-xs font-medium text-slate-400">
                  لا توجد جلسات قادمة مجدولة حالياً.
                </div>
              )}
            </div>

            {/* رابط صفحة الجلسات مع الترقيم والفلترة */}
            <div className="pt-3 mt-3 border-t border-slate-100">
              <Link
                href="/dashboard/instructor/sessions"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 px-4 text-xs font-bold text-white transition-colors hover:bg-slate-800 shadow-2xs"
              >
                <span>عرض والبحث في جميع الجلسات ({allBookings.length} جلسة)</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          {/* قسم باقات التدريب المعتمدة */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <h2 className="font-black text-slate-800 text-base">باقات التدريب المعتمدة لك</h2>
              </div>
              <Link
                href="/dashboard/instructor/settings"
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <span>طلب تعديل الباقات</span>
                <ChevronLeft className="h-3 w-3" />
              </Link>
            </div>

            {approvedPackages.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                أنت معتمد حالياً للتدريب في <strong>جميع الباقات المتاحة بالمنصة</strong>. يمكنك تحديد باقات معينة من صفحة الإعدادات في أي وقت.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {approvedPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{pkg.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {pkg.sessionsCount ? `${pkg.sessionsCount} جلسات` : ''}
                        {pkg.ageGroup ? ` • ${pkg.ageGroup}` : ''}
                      </span>
                    </div>
                    <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      معتمدة
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* العمود الجانبي (1 عمود): ودجت التقييمات وروابط الإدارة السريعة */}
        <div className="space-y-6">
          {/* بطاقة التقييمات المدمجة */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span>تقييمات المتدربين</span>
              </h3>
              <Link
                href="/dashboard/instructor/ratings"
                className="text-xs font-bold text-amber-700 hover:text-amber-800"
              >
                عرض الكل
              </Link>
            </div>

            <div className="text-center py-2">
              <div className="text-3xl font-black text-slate-900">
                {ratingSummary.average != null ? ratingSummary.average.toFixed(1) : '—'}
              </div>
              <div className="flex justify-center gap-1 my-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${
                      ratingSummary.average && s <= Math.round(ratingSummary.average)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                مبني على {ratingSummary.count} تقييم
              </div>
            </div>

            {latestReview && latestReview.comment && (
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 border border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-bold mb-1">
                  <span>{latestReview.reviewerName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {formatDate(latestReview.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-2 text-slate-600 font-medium italic">
                  &ldquo;{latestReview.comment}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* روابط الإدارة السريعة */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              إدارة سريعة
            </h3>
            <div className="space-y-1 text-xs font-bold">
              <Link
                href="/dashboard/instructor/settings"
                className="flex items-center justify-between rounded-xl p-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-600" />
                  <span>تعديل الجدول ونظام العمل</span>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link
                href="/dashboard/instructor/students"
                className="flex items-center justify-between rounded-xl p-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>قائمة ومتابعة المتدربين</span>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link
                href="/dashboard/instructor/services"
                className="flex items-center justify-between rounded-xl p-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>سوق الخدمات الإضافية</span>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link
                href="/dashboard/instructor/profile"
                className="flex items-center justify-between rounded-xl p-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-600" />
                  <span>الملف الشخصي العام</span>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
