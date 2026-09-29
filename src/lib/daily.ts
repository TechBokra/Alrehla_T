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

/**
 * بصمة المفتاح المنشور — **من غير ما نعرضه**.
 *
 * ⚠️ الغرض سؤال واحد: **أي مفتاح واصل للخادم فعلًا؟** لما يبقى في
 *    Vercel أكتر من متغيّر، ومتغيّر باسم غلط، ومفتاح من منتج تاني،
 *    الأربع احتمالات دي بتفرّق بينها أول أربع حروف والطول.
 *
 * ⚠️ **ومابنطبعش المفتاح ولا آخره.** أول أربع حروف وطول — ده
 *    بيفرّق بين مفتاحين ومابيديش حد وسيلة يستخدم أي واحد فيهم.
 *    والشاشة اللي بتعرضها للإدارة وحدها.
 */
export function dailyKeyFingerprint(): { present: boolean; prefix: string; length: number } {
  const key = process.env.DAILY_API_KEY ?? '';
  return {
    present: key.length > 0,
    prefix: key.slice(0, 4),
    length: key.length,
  };
}

export type DailyCheck = {
  ok: boolean;
  message: string;
  fingerprint: ReturnType<typeof dailyKeyFingerprint>;
  /** مسافات أو أسطر في أول المفتاح أو آخره — سبب متكرر للرفض. */
  hasWhitespace: boolean;
};

/**
 * فحص المفتاح بنداء حقيقي أخفّ ما يكون.
 *
 * بنطلب غرفة واحدة بس: لو الرد نجح، المفتاح شغّال؛ ولو اترفض، رسالة
 * Daily نفسها بتترجع. **ده أسرع من تخمين، وأصدق.**
 */
export async function checkDailyKey(): Promise<DailyCheck> {
  const raw = process.env.DAILY_API_KEY ?? '';
  const fingerprint = dailyKeyFingerprint();
  const hasWhitespace = raw !== raw.trim();

  if (!fingerprint.present) {
    return {
      ok: false,
      message:
        'مفيش متغيّر اسمه DAILY_API_KEY واصل للخادم. اتأكد إن اسمه بالحرف كده في Vercel، وإنك عملت Redeploy بعد ما ضفته.',
      fingerprint,
      hasWhitespace,
    };
  }

  const result = await call<unknown>('/rooms?limit=1');
  return {
    ok: result.ok,
    message: result.ok ? 'المفتاح شغّال وDaily بيرد.' : result.error,
    fingerprint,
    hasWhitespace,
  };
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
      console.error('Daily API error', path, response.status, body);

      // ⚠️ **رسالة Daily بتوصل للإدارة زي ما هي.**
      //
      //    أول مرة المفتاح اترفض، الشاشة قالت «مفتاح Daily مرفوض»
      //    وبس — ودي جملة **بتقول إن فيه مشكلة ومابتقولش إيه هي**.
      //    فضلنا نخمّن: المفتاح غلط؟ اتحط في متغيّر باسم تاني؟ ما
      //    اتنشرش؟ خدمة تانية؟ وكل تخمين جولة كاملة رايح جاي.
      //
      //    الرسالة اللي Daily بيبعتها فيها السبب الحقيقي — والشاشة
      //    دي مايشوفهاش غير إداري مسجَّل دخوله.
      const detail =
        typeof (body as { info?: string }).info === 'string'
          ? (body as { info: string }).info
          : typeof (body as { error?: string }).error === 'string'
            ? (body as { error: string }).error
            : '';

      if (response.status === 401) {
        return {
          ok: false,
          error:
            'Daily رفض المفتاح (401). ' +
            (detail ? `رسالته: «${detail}». ` : '') +
            'الأسباب المتكررة: المفتاح اتنسخ ناقص أو معاه مسافة، أو ده مفتاح منتج تاني من Daily مش مفتاح الـAPI، أو المتغيّر في Vercel اسمه مش DAILY_API_KEY بالحرف.',
        };
      }
      if (response.status === 404) {
        return { ok: false, error: 'الغرفة مش موجودة عند Daily.' };
      }
      return {
        ok: false,
        error: `Daily رفض الطلب (${response.status})${detail ? `: «${detail}»` : ''}.`,
      };
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

// ── التسجيلات ────────────────────────────────────────────────

/**
 * البادئة اللي غرف الجلسات بتتسمّى بيها (`createSessionRoom`).
 *
 * ⚠️ **وهي حارس الحذف.** أي تسجيل اسم غرفته مابيبدأش بالبادئة دي
 *    **مابنلمسوش**: مش بنحذفه لا يدويًّا ولا تلقائيًّا.
 *
 *    السبب هو نفس سبب `FOLDER` في Cloudinary: الحساب ممكن يتشارك مع
 *    مشروع تاني، والمهمة اليومية بتمسح بلا تراجع. القيد في الكود مش
 *    خيارًا في الشاشة.
 */
export const SESSION_ROOM_PREFIX = 'alrehla-';

export type DailyRecording = {
  id: string;
  roomName: string;
  /** بداية التسجيل — **وهي أساس حساب المدة، لا عمود في قاعدتنا**. */
  startedAt: string;
  /** بالثواني. صفر للتسجيل اللي لسه شغّال. */
  durationSeconds: number;
  /** `finished` أو `in-progress`. */
  status: string;
  /** رقم الجلسة المستخرَج من اسم الغرفة — `null` لو الغرفة مش غرفة جلسة. */
  sessionId: string | null;
};

type RawRecording = {
  id: string;
  room_name?: string;
  s3key?: string;
  start_ts?: number;
  duration?: number;
  status?: string;
};

/**
 * اسم الغرفة من صفّ التسجيل.
 *
 * ⚠️ **`room_name` مش مضمون في كل رد.** توثيق Daily بيسرد `s3key` في
 *    قايمة الحقول و`room_name` في المثال — والاتنين بيتغيّروا بين
 *    إصدارات. و`s3key` شكله `<domain>/<room>/<ts>`.
 *
 *    والفرق مش شكلي: الاسم هو اللي بيربط التسجيل بالجلسة **وهو اللي
 *    بيقرّر الحذف**. لو رجع فاضي، بنسيب التسجيل ومابنحذفوش — الحارس
 *    بيفشل مقفولًا لا مفتوحًا.
 */
function roomNameOf(raw: RawRecording): string {
  if (typeof raw.room_name === 'string' && raw.room_name) return raw.room_name;
  if (typeof raw.s3key === 'string' && raw.s3key.includes('/')) {
    const parts = raw.s3key.split('/');
    return parts.length >= 2 ? parts[parts.length - 2] : '';
  }
  return '';
}

function toRecording(raw: RawRecording): DailyRecording {
  const roomName = roomNameOf(raw);
  return {
    id: String(raw.id),
    roomName,
    startedAt: raw.start_ts ? new Date(raw.start_ts * 1000).toISOString() : '',
    durationSeconds: Number(raw.duration ?? 0),
    status: String(raw.status ?? ''),
    sessionId: roomName.startsWith(SESSION_ROOM_PREFIX)
      ? roomName.slice(SESSION_ROOM_PREFIX.length)
      : null,
  };
}

/**
 * تسجيلات الحساب، من الأحدث للأقدم.
 *
 * ⚠️ **بنقرا على صفحات ونقف عند سقف.** الشاشة مش تقرير: أكتر من
 *    بضع مئات بيعلّقها. والمهمة اليومية بتستعمل نفس الدالة بسقف
 *    أعلى، لأن اللي مابيتقريش **مابيتحذفش** فيفضل مخزَّنًا للأبد.
 */
export async function listRecordings(max = 200): Promise<DailyResult<DailyRecording[]>> {
  const out: DailyRecording[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('starting_after', cursor);

    const result = await call<{ data?: RawRecording[] }>(`/recordings?${query}`);
    if (!result.ok) return result;

    const rows = result.data?.data ?? [];
    if (rows.length === 0) break;

    for (const raw of rows) out.push(toRecording(raw));

    if (out.length >= max || rows.length < 100) break;
    cursor = rows[rows.length - 1]?.id;
    if (!cursor) break;
  }

  return { ok: true, data: out.slice(0, max) };
}

/**
 * رابط مشاهدة **مؤقّت**.
 *
 * ⚠️ **ومؤقّت هنا مش تشدّدًا زايدًا.** دي تسجيلات فيها أطفال. الرابط
 *    الدائم بيتنسخ على واتساب ويفضل شغّالًا للأبد بعد ما كل حد نسي
 *    إنه اتبعت — وده نفس سبب إن غرف الجلسات `private` والدخول
 *    بتذكرة.
 *
 * Daily بيقبل من ١٥ دقيقة لـ١٢ ساعة. بنطلب ساعة: تكفي للمراجعة
 * ومابتعيشش لبكرة.
 */
export async function getRecordingLink(
  recordingId: string,
  validForSecs = 3600,
): Promise<DailyResult<{ url: string; expiresAt: string }>> {
  const result = await call<{ download_link?: string; expires?: number }>(
    `/recordings/${encodeURIComponent(recordingId)}/access-link?valid_for_secs=${validForSecs}`,
  );
  if (!result.ok) return result;

  if (!result.data.download_link) {
    return { ok: false, error: 'Daily رد بلا رابط للتسجيل ده.' };
  }

  return {
    ok: true,
    data: {
      url: result.data.download_link,
      expiresAt: result.data.expires
        ? new Date(result.data.expires * 1000).toISOString()
        : new Date(Date.now() + validForSecs * 1000).toISOString(),
    },
  };
}

/** حذف تسجيل. **مالوش تراجع** — الحارس في `actions/recordings.ts`. */
export async function deleteRecording(recordingId: string): Promise<DailyResult<unknown>> {
  return call(`/recordings/${encodeURIComponent(recordingId)}`, { method: 'DELETE' });
}

/**
 * التسجيلات اللي عدّت مدة الاحتفاظ.
 *
 * ── ليه الحساب من بيانات Daily لا من قاعدتنا ────────────────
 *
 * `sessions.recording_expires_at` موجود، لكن الاعتماد عليه بيخلّي
 * الحذف يعتمد على صفّ **ممكن ما يكونش اتكتب**: غرفة اتعملت والكتابة
 * فشلت، أو جلسة اتحذفت وتسجيلها فضل. والتسجيل اللي مالوش صفّ
 * **مايتحذفش أبدًا** — وهو بالظبط التسجيل اللي محدّش فاكره.
 *
 * فالمدة بتتحسب من **بداية التسجيل نفسه** عند Daily. كل تسجيل ليه
 * تاريخ، فمفيش تسجيل بيفلت.
 *
 * ⚠️ **والأثر الجانبي مقصود ومكتوب:** لو الإدارة نزّلت المدة من شهر
 *    لأسبوع، التسجيلات اللي عدّى عليها أسبوع هتتمسح في أول تشغيل.
 *    ده معنى «بنحتفظ أسبوع» — والاتجاه ده هو الآمن: الأقصر بيحذف
 *    أكتر، والأطول مابيرجّعش اللي اتمسح.
 */
export function expiredRecordings(
  recordings: DailyRecording[],
  retentionDays: number,
  now = Date.now(),
): DailyRecording[] {
  if (!(retentionDays > 0)) return [];
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

  return recordings.filter((r) => {
    // ⚠️ اللي لسه بيتسجّل مابيتلمسش مهما كان تاريخه.
    if (r.status === 'in-progress') return false;
    // ⚠️ برّه بادئة غرف الجلسات = مش بتاعنا.
    if (!r.roomName.startsWith(SESSION_ROOM_PREFIX)) return false;
    // ⚠️ بلا تاريخ = بلا حذف. مانعرفش عمره، والشك بيمنع لا بيسمح.
    if (!r.startedAt) return false;
    return new Date(r.startedAt).getTime() < cutoff;
  });
}
