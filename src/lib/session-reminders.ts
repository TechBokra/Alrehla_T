import { cairoParts, cairoWallClockToUtc, formatCairo } from '@/lib/timezone';

/**
 * تذكير يوم الجلسة (ملاحظة الفريق، 10 أكتوبر: «إشعار تذكير يروح للطالب
 * وولي الأمر يوم الجلسة»). المهمة اليومية `api/cron/session-reminders`.
 *
 * الملف ده من غير قاعدة بيانات عشان يتجرّب: بيحسب «النهارده» بتوقيت
 * القاهرة، ومين يوصله تذكير، وبأنهي رابط.
 */

/** بداية ونهاية اليوم الحالي بتوقيت القاهرة (UTC). */
export function cairoTodayRange(now: Date): { start: Date; end: Date } {
  const p = cairoParts(now);
  const start = cairoWallClockToUtc({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 });
  const next = new Date(start.getTime() + 36 * 60 * 60 * 1000); // أي وقت في اليوم اللي بعده
  const n = cairoParts(next);
  const end = cairoWallClockToUtc({ year: n.year, month: n.month, day: n.day, hour: 0, minute: 0 });
  return { start, end };
}

export type ReminderSession = {
  id: string;
  scheduledAt: string;
  sessionNumber: number;
  packageName: string | null;
  bookerId: string;
  childId: string | null;
  childName: string | null;
  childAccountId: string | null;
  instructorUserId: string | null;
};

export type ReminderRow = { recipient_profile_id: string; title: string; message: string; link: string };

/** التذكيرات لجلسة واحدة: صاحب الحجز، وحساب الطفل لو موجود، والمدرب. */
export function remindersFor(s: ReminderSession): ReminderRow[] {
  const time = formatCairo(s.scheduledAt, { timeStyle: 'short' });
  const what = `الجلسة ${s.sessionNumber}${s.packageName ? ` — ${s.packageName}` : ''}`;
  const rows: ReminderRow[] = [];

  rows.push({
    recipient_profile_id: s.bookerId,
    title: s.childName ? `تذكير: جلسة ${s.childName} النهارده الساعة ${time}` : `تذكير: جلستك النهارده الساعة ${time}`,
    message: `${what}. زرار الدخول بيتفتح قبل الميعاد بـ١٥ دقيقة.`,
    link: s.childId ? `/account/family/${s.childId}` : `/dashboard/student/sessions/${s.id}`,
  });

  if (s.childAccountId && s.childAccountId !== s.bookerId) {
    rows.push({
      recipient_profile_id: s.childAccountId,
      title: `تذكير: جلستك النهارده الساعة ${time}`,
      message: `${what}. جهّز اللي هتكتبه وادخل في الميعاد.`,
      link: `/dashboard/student/sessions/${s.id}`,
    });
  }

  if (s.instructorUserId) {
    rows.push({
      recipient_profile_id: s.instructorUserId,
      title: `تذكير: عندك جلسة النهارده الساعة ${time}`,
      message: `${what}${s.childName ? ` مع ${s.childName}` : ''}.`,
      link: `/dashboard/instructor/sessions/${s.id}`,
    });
  }
  return rows;
}
