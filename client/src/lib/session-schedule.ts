import type { WeeklySlot, DayOfWeek } from '@/types';
import { cairoParts, cairoWallClockToUtc, addCairoDays } from '@/lib/timezone';

/**
 * توليد مواعيد الجلسات.
 *
 * ليه موجودة: تأكيد الدفع كان بيحوّل الاشتراك لـ«نشط» و**مبيعملش ولا
 * جلسة**. ولوحة الطالب ولوحة المدرب الاتنين بيقروا من جدول الجلسات —
 * فالاتنين كانوا بيفضلوا فاضيين بعد كل عملية شراء ناجحة.
 *
 * المواعيد دي **مبدئية**: جلسة كل أسبوع في أول ميعاد من جدول المدرب
 * الأسبوعي. الإدارة بتعدّلها من شاشة الحجوزات، وأي تعديل بيوصل إشعار
 * للطرفين.
 *
 * عشان كده حالة الجلسة بتبقى `pending` مش `confirmed`: الميعاد اتحسب
 * مش اتفق عليه.
 *
 * ⚠️ كل الحساب هنا بساعة الحيطة في القاهرة. كان بـ`setHours()` اللي
 * بتستخدم توقيت الخادم — وخادم Vercel بيشتغل UTC، فالمدرب اللي بيختار
 * «18:00» كانت جلساته بتتسجّل 18:00 UTC والمستخدم في مصر يشوفها 21:00.
 */
const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** أول يوم مسموح: بعد بكرة. حجز بيبدأ النهارده مش واقعي. */
const LEAD_DAYS = 2;

export function buildSessionSchedule(params: {
  count: number;
  weeklySchedule?: WeeklySlot[] | null;
  /**
   * الموعد اللي العميل اختاره بنفسه وقت الحجز.
   *
   * له الأولوية المطلقة على جدول المدرب: ده اللي شافه في ملخص الحجز
   * ووافق عليه. من غيره كانت الجلسات بتتولّد من أول ميعاد فاضي في
   * الجدول، فالعميل يختار الثلاثاء ٦م ويتجدول الأحد ٤م.
   */
  preferredSlot?: WeeklySlot | { day: DayOfWeek; time: string } | null;
  /** من إمتى نبدأ نعدّ — عادةً لحظة تأكيد الدفع. */
  from?: Date;
}): string[] {
  const { count } = params;
  if (count <= 0) return [];

  const from = params.from ?? new Date();
  const earliest = new Date(from.getTime() + LEAD_DAYS * 24 * 60 * 60 * 1000);

  const slot = normalizePreferred(params.preferredSlot) ?? pickSlot(params.weeklySchedule);

  // مفيش جدول للمدرب (أو مفيش مدرب أصلًا): بنحجز نفس يوم وساعة التأكيد
  // أسبوعيًا. تخمين صريح، والإدارة بتصلّحه.
  if (!slot) {
    const dates: string[] = [];
    let w = cairoParts(earliest);
    for (let i = 0; i < count; i += 1) {
      dates.push(cairoWallClockToUtc(w).toISOString());
      w = addCairoDays(w, 7);
    }
    return dates;
  }

  let wall = firstSlotWallClock(earliest, slot);

  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // أسبوع = **سبع أيام تقويمية** مش 7×24 ساعة. الفرق بيبان لما
    // التوقيت الصيفي يبدأ أو يخلص: الجمع بالساعات كان بيزحلق ميعاد
    // الطالب ساعة كاملة في نص الباقة.
    dates.push(cairoWallClockToUtc(wall).toISOString());
    wall = addCairoDays(wall, 7);
  }
  return dates;
}

/**
 * اختيار العميل، بعد التأكد إنه مفهوم.
 *
 * يوم مش في أيام الأسبوع أو وقت فاضي = بنتجاهله ونرجع لجدول المدرب،
 * مش بنولّد مواعيد على قيمة بايظة.
 */
function normalizePreferred(
  slot?: WeeklySlot | { day: DayOfWeek; time: string } | null
): WeeklySlot | null {
  if (!slot || !slot.day || !slot.time) return null;
  if (!(slot.day in DAY_INDEX)) return null;
  return { day: slot.day, time: slot.time, isBooked: false } as WeeklySlot;
}

/** أول ميعاد غير محجوز في الجدول، بترتيب أيام الأسبوع. */
function pickSlot(schedule?: WeeklySlot[] | null): WeeklySlot | null {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const free = schedule.filter((s) => !s.isBooked && s.day in DAY_INDEX && s.time);
  if (free.length === 0) return null;
  return [...free].sort(
    (a, b) =>
      DAY_INDEX[a.day] - DAY_INDEX[b.day] || a.time.localeCompare(b.time)
  )[0];
}

/** أقرب ساعة حيطة في أو بعد `earliest` توافق يوم وساعة الميعاد. */
function firstSlotWallClock(earliest: Date, slot: WeeklySlot) {
  const [hours, minutes] = slot.time.split(':').map((n) => parseInt(n, 10));
  const target = DAY_INDEX[slot.day];

  let wall = {
    ...cairoParts(earliest),
    hour: Number.isFinite(hours) ? hours : 16,
    minute: Number.isFinite(minutes) ? minutes : 0,
    second: 0,
  };

  // لو الساعة عدّت النهارده، ابدأ من بكرة قبل ما تدوّر على اليوم.
  if (cairoWallClockToUtc(wall).getTime() < earliest.getTime()) {
    wall = addCairoDays(wall, 1);
  }

  const diff = (target - wall.weekday + 7) % 7;
  return diff === 0 ? wall : addCairoDays(wall, diff);
}
