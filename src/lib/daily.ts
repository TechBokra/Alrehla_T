/**
 * طبقة Daily.co — **الخادم وحده**.
 *
 * ⚠️ **مفتاح Daily مابيلمسش المتصفح أبدًا.** الملف ده مافيهوش
 *    `'use client'` ومحدّش بيستورده من مكوّن متصفح. المفتاح بيدّي
 *    تحكّمًا كاملًا في الحساب: إنشاء غرف، وقراءة التسجيلات، وحذفها.
 *
 * ── قاعدة الدخول في المشروع ─────────────────────────────────
 *
 * **الغرف كلها `private`، والدخول بتذكرة.**
 *
 * يعني رابط الغرفة لوحده **مايكفيش للدخول**. لازم تذكرة بتتولّد على
 * الخادم لحظة الضغط، باسم الشخص وصلاحيته ووقت صلاحية محدود.
 *
 * ⚠️ والسبب إن دي غرف فيها أطفال. رابط عام بيتنقل على واتساب
 *    وبيفضل شغّالًا للأبد؛ التذكرة بتنتهي مع الجلسة.
 *
 * ── وكل دالة بترجّع نتيجة، مابترميش ───────────────────────
 *
 * Next بيمسح نصّ الخطأ في الإنتاج (قاعدة «هـ»)، فالرمي بيوصل
 * للشاشة كـ«حصل خطأ» بلا أي معنى. كل دالة هنا بترجّع
 * `{ ok: false, error }` بنصّ عربي واضح.
 */

const API = 'https://api.daily.co/v1';

export type DailyResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** فيه مفتاح مظبوط؟ الشاشات بتسأل الأول بدل ما تعرض زرًّا ما بيشتغلش. */
export function isDailyConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY);
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<DailyResult<T>> {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    return { ok: false, error: 'مفتاح Daily مش مظبوط على الخادم.' };
  }

  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      // بيانات الغرف بتتغيّر كل ثانية — التخزين المؤقت هنا بيكدب.
      cache: 'no-store',
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      // ⚠️ رسالة Daily بتتسجّل عندنا ومابتتعرضش كاملة للمستخدم:
      //    ممكن تحتوي أسماء غرف أو تفاصيل حساب.
      console.error('Daily API error', path, response.status, body);
      if (response.status === 401) {
        return { ok: false, error: 'مفتاح Daily مرفوض — راجع الإعدادات.' };
      }
      if (response.status === 404) {
        return { ok: false, error: 'الغرفة مش موجودة عند Daily.' };
      }
      return { ok: false, error: `Daily رفض الطلب (${response.status}).` };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    console.error('Daily API unreachable', path, err);
    return { ok: false, error: 'مقدرناش نوصل لـDaily. جرّب تاني.' };
  }
}

// ── الغرف ────────────────────────────────────────────────────

export type DailyRoom = { name: string; url: string };

/**
 * غرفة جلسة.
 *
 * ⚠️ **`exp` مهم مش تفصيلة.** الغرفة اللي مالهاش نهاية بتفضل مفتوحة
 *    للأبد، وبتتحسب في الاستخدام لو حد فضل فيها. بنقفلها بعد نهاية
 *    الجلسة بنص ساعة، و`eject_at_room_exp` بيطلّع اللي لسه جوّه.
 *
 * ⚠️ و`nbf` بيمنع الدخول قبل الموعد بربع ساعة — عشان محدّش يفتح
 *    غرفة جلسة بكرة النهاردة.
 */
export async function createSessionRoom(params: {
  sessionId: string;
  startsAt: Date;
  durationMinutes: number;
  recordingEnabled: boolean;
}): Promise<DailyResult<DailyRoom>> {
  const { sessionId, startsAt, durationMinutes, recordingEnabled } = params;

  const start = Math.floor(startsAt.getTime() / 1000);
  const nbf = start - 15 * 60;
  const exp = start + durationMinutes * 60 + 30 * 60;

  return call<DailyRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      // الاسم مشتقّ من رقم الجلسة: مطابقة بيانات Daily بالجلسة من
      // غير ما نخزّن جدول ربط تاني.
      name: `alrehla-${sessionId}`,
      privacy: 'private',
      properties: {
        nbf,
        exp,
        eject_at_room_exp: true,
        // جلسة فردية: مدرب وطالب، وولي أمر أو إداري يتابع.
        max_participants: 6,
        enable_recording: recordingEnabled ? 'cloud' : undefined,
        enable_prejoin_ui: true,
        enable_screenshare: true,
        enable_chat: true,
      },
    }),
  });
}

/**
 * غرفة تجربة — مش مربوطة بجلسة ولا بتسجيل.
 *
 * بتنتهي بعد ساعة، عشان اللوحة ما تتملاش غرف تجارب منسية بتتحاسب
 * في الاستخدام.
 */
export async function createTestRoom(): Promise<DailyResult<DailyRoom>> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;

  return call<DailyRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: `test-${Date.now().toString(36)}`,
      privacy: 'private',
      properties: {
        exp,
        eject_at_room_exp: true,
        max_participants: 4,
        // ⚠️ **التجربة مابتتسجّلش.** تسجيل بيتحاسب، وتجربة الشبكة
        //    مالهاش أي سبب يخلّيها تتسجّل.
        enable_prejoin_ui: true,
      },
    }),
  });
}

export async function deleteRoom(name: string): Promise<DailyResult<unknown>> {
  return call(`/rooms/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ── التذاكر ──────────────────────────────────────────────────

/**
 * تذكرة دخول باسم شخص بعينه.
 *
 * ⚠️ **`isOwner` مش رتبة — هي صلاحية.** المالك يقدر يبدأ التسجيل
 *    ويطرد مشاركًا. المدرب والإدارة مالكين؛ الطالب وولي الأمر لأ.
 *
 * ⚠️ و`startRecording` **بيحتاج خطة مدفوعة عند Daily**. على الخطة
 *    المجانية التذكرة بتتقبل والتسجيل مابيبدأش — من غير رسالة خطأ.
 *    فالشاشة بتقول للإدارة إن التسجيل محتاج اشتراك.
 */
export async function createMeetingToken(params: {
  roomName: string;
  userName: string;
  userId?: string;
  isOwner: boolean;
  expiresAt: Date;
  startRecording?: boolean;
}): Promise<DailyResult<{ token: string }>> {
  const { roomName, userName, userId, isOwner, expiresAt, startRecording } = params;

  return call<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: userId,
        is_owner: isOwner,
        exp: Math.floor(expiresAt.getTime() / 1000),
        ...(startRecording ? { start_cloud_recording: true } : {}),
      },
    }),
  });
}

// ── الحضور المباشر ───────────────────────────────────────────

export type DailyPresenceParticipant = {
  userId: string;
  userName: string;
  room: string;
  joinTime: string;
  duration: number;
};

/**
 * مين في أي غرفة **دلوقتي**.
 *
 * ⚠️ Daily بيقول إن البيانات دي بتتأخر لحد **١٥ ثانية**، وبينصح
 *    ما نسألش أكتر من مرة كل ١٥ ثانية. فالشاشة بتحدّث كل نص دقيقة —
 *    التحديث الأسرع مابيديش بيانات أجدد، بيستهلك بس.
 */
export async function getPresence(): Promise<DailyResult<DailyPresenceParticipant[]>> {
  const result = await call<Record<string, unknown>>('/presence');
  if (!result.ok) return result;

  const out: DailyPresenceParticipant[] = [];
  const data = result.data as { [room: string]: unknown };

  for (const [room, value] of Object.entries(data ?? {})) {
    if (!Array.isArray(value)) continue;
    for (const p of value as Record<string, unknown>[]) {
      out.push({
        userId: String(p.userId ?? p.user_id ?? ''),
        userName: String(p.userName ?? p.user_name ?? 'مشارك'),
        room,
        joinTime: String(p.joinTime ?? p.join_time ?? ''),
        duration: Number(p.duration ?? 0),
      });
    }
  }

  return { ok: true, data: out };
}

// ── الاستخدام ────────────────────────────────────────────────

export type DailyUsage = {
  /** دقائق المشاركين — وهي وحدة الحساب عند Daily. */
  participantMinutes: number;
  /** عدد الجلسات اللي اتحسبت. */
  meetings: number;
  /** أطول جلسة بالدقايق — بيكشف غرفة فضلت مفتوحة بالغلط. */
  longestMeetingMinutes: number;
  /** الفترة اللي الأرقام دي بتغطّيها. */
  since: string;
};

type DailyMeeting = {
  id: string;
  room: string;
  start_time: number;
  duration: number;
  participants?: { duration?: number }[];
};

/**
 * استهلاك الشهر الحالي.
 *
 * ⚠️ **بنجمع مدة كل مشارك، مش مدة الجلسة.** جلسة نص ساعة فيها
 *    اتنين = **ستين دقيقة مشارك** عند Daily، مش تلاتين. الخلط ده
 *    بيخلّي التقدير نص الحقيقة — واللي بيتبني عليه قرار «امتى
 *    نشترك».
 *
 * ⚠️ وبنقرا على صفحات: الحساب ممكن يكون فيه مئات الجلسات، والصفحة
 *    الواحدة محدودة. بنقف عند حد أقصى عشان الشاشة ما تعلّقش.
 */
export async function getMonthUsage(): Promise<DailyResult<DailyUsage>> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = Math.floor(monthStart.getTime() / 1000);

  let participantSeconds = 0;
  let meetings = 0;
  let longest = 0;
  let cursor: string | undefined;

  // 10 صفحات × 100 = 1000 جلسة. أكتر من كده مش شاشة، ده تقرير.
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('starting_after', cursor);

    const result = await call<{ data?: DailyMeeting[] }>(`/meetings?${query}`);
    if (!result.ok) return result;

    const rows = result.data?.data ?? [];
    if (rows.length === 0) break;

    let reachedOlder = false;
    for (const meeting of rows) {
      if (meeting.start_time < since) {
        reachedOlder = true;
        continue;
      }
      meetings += 1;
      longest = Math.max(longest, Math.round((meeting.duration ?? 0) / 60));
      for (const participant of meeting.participants ?? []) {
        participantSeconds += Number(participant.duration ?? 0);
      }
    }

    // الجلسات بتيجي من الأحدث للأقدم، فأول ما نعدّي أول الشهر نقف.
    if (reachedOlder || rows.length < 100) break;
    cursor = rows[rows.length - 1]?.id;
    if (!cursor) break;
  }

  return {
    ok: true,
    data: {
      participantMinutes: Math.round(participantSeconds / 60),
      meetings,
      longestMeetingMinutes: longest,
      since: monthStart.toISOString(),
    },
  };
}

/** الحد المجاني الشهري عند Daily — بيتقارن بيه في اللوحة. */
export const DAILY_FREE_MINUTES = 10_000;
