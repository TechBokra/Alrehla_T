import React from 'react';
import { AlertTriangle, Radio, Gauge, CalendarClock, Clapperboard } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getSessionsForAdmin } from '@/data/domains/writing';
import { getSiteSettings } from '@/data/domains/content';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCairo } from '@/lib/timezone';
import { sessionStatusView } from '@/lib/session-status';
import { retentionLabel } from '@/lib/session-recording';
import {
  DAILY_FREE_MINUTES,
  SESSION_ROOM_PREFIX,
  checkDailyKey,
  expiredRecordings,
  getMonthUsage,
  getPresence,
  getRoomsRecording,
  isDailyConfigured,
  listRecordings,
} from '@/lib/daily';
import { RoomActions, JoinRoomButton, RebuildRoomsButton } from './RoomsClient';
import {
  WatchRecordingButton,
  DeleteRecordingButton,
  PurgeNowButton,
} from './RecordingsClient';

export const dynamic = 'force-dynamic';

/**
 * الغرف والجلسات المباشرة.
 *
 * ── التلات أسئلة اللي الشاشة دي بترد عليها ──────────────────
 *
 * **① مين في جلسة دلوقتي؟** من `GET /presence` عند Daily. الإدارة
 *    بتشوف الغرف الشغّالة ومين فيها، وتقدر تدخل أي واحدة.
 *
 * **② استهلكنا قد إيه الشهر ده؟** من `GET /meetings`، بجمع **مدة
 *    كل مشارك** لا مدة الجلسة: جلسة نص ساعة فيها اتنين = ستين
 *    دقيقة مشارك عند Daily مش تلاتين. الخلط ده بيخلّي التقدير نص
 *    الحقيقة.
 *
 * **③ الجلسات القادمة ليها غرف؟** من قاعدتنا إحنا. وده اللي كشف
 *    إن ٥٨ جلسة مجدولة كانت بلا أي رابط دخول.
 *
 * ⚠️ **فشل Daily مايكسرش الشاشة.** لو المفتاح غلط أو الخدمة مش
 *    راضية ترد، قسم القاعدة بتاعنا بيفضل شغّال ورسالة بتقول إيه
 *    اللي مش متاح — مش صفحة خطأ فاضية.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const ready = isDailyConfigured();

  // ⚠️ **الفحص بيتعمل أول حاجة.** لو المفتاح مرفوض، باقي النداءات
  //    هترجع نفس الخطأ تلات مرات في تلات أماكن مختلفة — والإدارة
  //    بتقرا «فيه مشكلة» تلاتة من غير ما تعرف إيه هي.
  const [check, sessions, settings, presence, usage, recordings] = await Promise.all([
    checkDailyKey(),
    getSessionsForAdmin(),
    getSiteSettings(),
    ready ? getPresence() : Promise.resolve(null),
    ready ? getMonthUsage() : Promise.resolve(null),
    ready ? listRecordings(100) : Promise.resolve(null),
  ]);

  const now = Date.now();
  const upcoming = sessions
    .filter(
      (s) =>
        s.status !== 'completed' &&
        s.status !== 'cancelled' &&
        new Date(s.scheduledAt).getTime() > now,
    )
    .slice(0, 50);

  const withoutRoom = upcoming.filter((s) => !s.roomName).length;

  // ── الغرف بتتسجّل فعلًا؟ ──────────────────────────────────
  //
  // ⚠️ **`enable_recording` بينكتب في الغرفة ساعة ما تتعمل.** يعني
  //    غرفة اتعملت والتسجيل مقفول **مش هتسجّل أبدًا** حتى لو
  //    الإعداد اتفتح بعدها.
  //
  //    والشاشة كانت بتقول «التسجيل شغّال» من **الإعداد** — وعد عن
  //    خانة في لوحة التحكم، مش عن الغرف اللي الأطفال هيدخلوها.
  //    ولأن السياسة بتقول لولي الأمر إن الجلسة بتتسجّل، الفجوة دي
  //    **وعد مكسور بيعدّي بلا أي عَرَض**: مفيش خطأ، بس قايمة
  //    تسجيلات بتفضل فاضية.
  //
  // ⚠️ **وبنفحص أقرب عشرة وبس.** ده نداء شبكة لكل غرفة — فحص
  //    خمسين غرفة في كل فتحة للصفحة بيعلّقها وبيستهلك حصة الـAPI.
  //    والعشرة الأقرب هم اللي هيحصلوا الأول.
  const soonest = upcoming.filter((s) => s.roomName).slice(0, 10);
  const roomRecording = ready
    ? await getRoomsRecording(soonest.map((s) => s.roomName as string))
    : new Map<string, boolean>();

  const wantRecording = settings.sessionRecording.enabled;
  const staleRooms = soonest.filter((s) => {
    const actual = roomRecording.get(s.roomName as string);
    // غرفة ماعرفناش حالتها مش «قديمة» — الشك مايطلعش تحذيرًا.
    return actual !== undefined && actual !== wantRecording;
  });

  const minutes = usage?.ok ? usage.data.participantMinutes : 0;
  const percent = Math.min(100, Math.round((minutes / DAILY_FREE_MINUTES) * 100));

  // ⚠️ التقدير خطّي على أيام الشهر — تقريب صريح، مش تنبّؤ. بيتكتب
  //    جنبه إنه تقدير عشان محدّش يبني عليه قرار وهو فاكره رقمًا.
  const dayOfMonth = new Date().getDate();
  const projected = dayOfMonth > 0 ? Math.round((minutes / dayOfMonth) * 30) : 0;

  const liveRows = (presence?.ok ? presence.data : []).map((p) => {
    const session = sessions.find((s) => s.roomName === p.room);
    return {
      room: p.room,
      who: p.userName,
      since: p.joinTime ? formatCairo(p.joinTime, { timeStyle: 'short' }) : '—',
      minutes: `${Math.round(p.duration / 60)} دقيقة`,
      sessionDisplay: session
        ? `${session.participantName} · ${session.instructorName ?? 'بلا مدرب'}`
        : 'غرفة تجربة',
      action: session ? <JoinRoomButton sessionId={session.id} /> : '—',
    };
  });

  const upcomingRows = upcoming.map((s) => {
    const view = sessionStatusView(s.status);
    return {
      ...s,
      sessionDisplay: `جلسة ${s.sessionNumber} · ${s.participantName}`,
      instructorDisplay: s.instructorName ?? 'لم يُسنَد',
      dateDisplay: formatCairo(s.scheduledAt, { dateStyle: 'medium', timeStyle: 'short' }),
      statusDisplay: <StatusBadge type={view.badge} label={view.label} />,
      roomDisplay: s.roomName ? (
        <StatusBadge type="success" label="الغرفة جاهزة" />
      ) : (
        <StatusBadge type="danger" label="بلا غرفة" />
      ),
      joinDisplay: s.roomName ? <JoinRoomButton sessionId={s.id} /> : '—',
      // ⚠️ الحالة دي مقروءة من Daily لكل غرفة، مش من الإعداد.
      recordingDisplay: !s.roomName ? (
        '—'
      ) : roomRecording.get(s.roomName) === undefined ? (
        <span className="text-xs font-medium text-slate-400">مش متأكدين</span>
      ) : roomRecording.get(s.roomName) ? (
        <StatusBadge type="success" label="بتتسجّل" />
      ) : (
        <StatusBadge type={wantRecording ? 'danger' : 'neutral'} label="مش بتتسجّل" />
      ),
    };
  });

  // ── التسجيلات ──────────────────────────────────────────────
  //
  // ⚠️ **بنعرض تسجيلات غرف الجلسات وبس.** أي تسجيل اسم غرفته
  //    مابيبدأش بالبادئة مش بتاعنا — الحساب ممكن يتشارك مع مشروع
  //    تاني، والشاشة دي مش بوابة على تسجيلاته.
  const ourRecordings = (recordings?.ok ? recordings.data : []).filter((r) =>
    r.roomName.startsWith(SESSION_ROOM_PREFIX),
  );

  // اللي هيتمسح في أول تشغيل للمهمة — بيتعلّم عشان الإدارة تشوفه
  // **قبل** ما يروح، مش تكتشف غيابه بعدين.
  const dueIds = new Set(
    settings.sessionRecording.enabled
      ? expiredRecordings(ourRecordings, settings.sessionRecording.retentionDays).map(
          (r) => r.id,
        )
      : [],
  );

  const canDeleteRecordings = user?.role === 'super_admin';

  const recordingRows = ourRecordings.map((r) => {
    const session = sessions.find((s) => s.id === r.sessionId);
    const label = session
      ? `جلسة ${session.sessionNumber} · ${session.participantName}`
      : 'جلسة محذوفة';
    const when = r.startedAt
      ? formatCairo(r.startedAt, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    return {
      id: r.id,
      sessionDisplay: label,
      instructorDisplay: session?.instructorName ?? '—',
      whenDisplay: when,
      lengthDisplay:
        r.status === 'in-progress'
          ? 'بيتسجّل دلوقتي'
          : `${Math.round(r.durationSeconds / 60)} دقيقة`,
      stateDisplay: dueIds.has(r.id) ? (
        <StatusBadge type="warning" label="هيتمسح في أقرب تشغيل" />
      ) : (
        <StatusBadge type="success" label="محفوظ" />
      ),
      watchDisplay:
        r.status === 'in-progress' ? (
          <span className="text-xs font-medium text-slate-400">لسه شغّال</span>
        ) : (
          <WatchRecordingButton recordingId={r.id} roomName={r.roomName} />
        ),
      deleteDisplay: (
        <DeleteRecordingButton
          recordingId={r.id}
          roomName={r.roomName}
          label={`${label} — ${when}`}
          canDelete={canDeleteRecordings}
        />
      ),
    };
  });

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الغرف والجلسات المباشرة" />

      {!check.ok && (
        <section className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-black text-rose-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            الاتصال بـDaily مش شغّال
          </h2>
          <p className="mb-4 text-sm leading-relaxed font-bold text-rose-900">
            {check.message}
          </p>

          {/* ⚠️ البصمة دي بتجاوب على سؤال واحد: **أي مفتاح واصل
              للخادم فعلًا؟** أول أربع حروف بتفرّق بين مفتاح ومفتاح
              من غير ما تعرض ولا واحد منهم. */}
          <dl className="grid gap-2 text-xs font-bold text-rose-800 sm:grid-cols-3">
            <div className="rounded-xl bg-white/60 p-3">
              <dt className="text-rose-500">المتغيّر واصل؟</dt>
              <dd className="mt-1">{check.fingerprint.present ? 'أيوه' : '**لأ**'}</dd>
            </div>
            <div className="rounded-xl bg-white/60 p-3">
              <dt className="text-rose-500">أول حروفه</dt>
              <dd dir="ltr" className="mt-1 text-right font-mono">
                {check.fingerprint.prefix || '—'}…
              </dd>
            </div>
            <div className="rounded-xl bg-white/60 p-3">
              <dt className="text-rose-500">طوله</dt>
              <dd className="mt-1">{check.fingerprint.length} حرف</dd>
            </div>
          </dl>

          {check.hasWhitespace && (
            <p className="mt-3 text-sm font-bold text-rose-900">
              ⚠️ المفتاح فيه مسافة أو سطر في أوله أو آخره — اتنسخ ناقص أو
              بزيادة. امسحه وألصقه تاني.
            </p>
          )}
        </section>
      )}

      {withoutRoom > 0 && (
        <p className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            فيه <strong>{withoutRoom}</strong> جلسة قادمة بلا غرفة — يعني لو جه
            ميعادها، المدرب والطالب مالهمش مكان يتقابلوا فيه. اضغط «جهّز غرف
            الجلسات القادمة».
          </span>
        </p>
      )}

      {/* ⚠️ **أخطر لافتة في الشاشة دي.**
          الإعدادات بتقول «بنسجّل»، والسياسة بتقول لولي الأمر إن
          جلسة ابنه بتتسجّل، والغرفة مش بتسجّل — ومفيش رسالة خطأ في
          أي مكان. العَرَض الوحيد قايمة تسجيلات فاضية، وده بيتقري
          «لسه مفيش جلسات» لا «الوعد مكسور». */}
      {staleRooms.length > 0 && (
        <section className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-black text-rose-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {wantRecording
              ? 'فيه غرف قادمة مش هتتسجّل'
              : 'فيه غرف قادمة لسه بتتسجّل'}
          </h2>
          <p className="mb-4 text-sm leading-relaxed font-bold text-rose-900">
            {wantRecording ? (
              <>
                <strong>{staleRooms.length}</strong> من أقرب الجلسات غرفها
                اتعملت والتسجيل كان مقفول، وإعداد التسجيل بيتكتب في الغرفة ساعة
                ما تتعمل — ففتح الإعداد بعدها مالوش أثر عليها. والسياسة بتقول
                لولي الأمر إن الجلسة بتتسجّل.
              </>
            ) : (
              <>
                <strong>{staleRooms.length}</strong> من أقرب الجلسات غرفها
                اتعملت والتسجيل كان مفتوح، فهتفضل بتسجّل رغم إن الإعداد اتقفل.
              </>
            )}
          </p>
          <RebuildRoomsButton count={staleRooms.length} />
        </section>
      )}

      <div className="mb-8">
        <RoomActions dailyReady={ready} />
      </div>

      {/* ── الاستهلاك ─────────────────────────────────────── */}
      <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-800">
          <Gauge className="h-5 w-5 text-slate-400" />
          استهلاك الشهر
        </h2>
        <p className="mb-6 text-sm font-medium text-slate-500">
          الحساب عند Daily بـ«دقيقة المشارك»: جلسة نص ساعة فيها اتنين = ٦٠
          دقيقة، مش ٣٠.
        </p>

        {usage && !usage.ok ? (
          <p className="text-sm font-bold text-rose-600">{usage.error}</p>
        ) : (
          <>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-2xl font-black text-slate-800">
                {minutes.toLocaleString('ar-EG')}{' '}
                <span className="text-base font-bold text-slate-400">
                  / {DAILY_FREE_MINUTES.toLocaleString('ar-EG')} دقيقة مجانية
                </span>
              </span>
              <span className="text-sm font-bold text-slate-500">{percent}%</span>
            </div>
            <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="جلسات الشهر" value={usage?.ok ? String(usage.data.meetings) : '—'} />
              <Stat
                label="أطول جلسة"
                value={usage?.ok ? `${usage.data.longestMeetingMinutes} دقيقة` : '—'}
                hint="رقم كبير غير متوقّع = غرفة فضلت مفتوحة"
              />
              <Stat
                label="المتوقّع آخر الشهر"
                value={`${projected.toLocaleString('ar-EG')} دقيقة`}
                hint="تقدير خطّي — مش تنبّؤ"
              />
            </div>

            {projected > DAILY_FREE_MINUTES && (
              <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                بالمعدّل الحالي هتعدّي الحد المجاني قبل آخر الشهر. ده وقت
                الاشتراك — مش لما الخدمة تقف.
              </p>
            )}
          </>
        )}

        {settings.sessionRecording.enabled && (
          <p className="mt-6 border-t border-slate-100 pt-4 text-sm font-medium text-slate-500">
            التسجيل شغّال، والاحتفاظ {retentionLabel(settings.sessionRecording.retentionDays)}.
            <strong className="text-slate-700">
              {' '}
              دقايق التسجيل بتتحاسب لوحدها ومش داخلة في المجاني.
            </strong>
          </p>
        )}
      </section>

      {/* ── دلوقتي ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-800">
          <Radio className="h-5 w-5 text-emerald-500" />
          دلوقتي في غرفة
        </h2>
        <p className="mb-4 text-sm font-medium text-slate-500">
          بيانات Daily بتتأخر لحد ١٥ ثانية. حدّث الصفحة للأحدث.
        </p>
        {presence && !presence.ok ? (
          <p className="text-sm font-bold text-rose-600">{presence.error}</p>
        ) : (
          <SimpleDataTable
            columns={[
              { header: 'المشارك', accessorKey: 'who' },
              { header: 'الجلسة', accessorKey: 'sessionDisplay' },
              { header: 'دخل الساعة', accessorKey: 'since' },
              { header: 'قاعد', accessorKey: 'minutes' },
              { header: '', accessorKey: 'action' },
            ]}
            data={liveRows}
            enableSearch={false}
            enablePagination={false}
            emptyMessage="مفيش حد في أي غرفة دلوقتي."
          />
        )}
      </section>

      {/* ── التسجيلات ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-800">
          <Clapperboard className="h-5 w-5 text-slate-400" />
          التسجيلات
        </h2>
        <p className="mb-4 text-sm font-medium text-slate-500">
          {settings.sessionRecording.enabled ? (
            <>
              الاحتفاظ {retentionLabel(settings.sessionRecording.retentionDays)}، وبعدها
              التسجيل بيتمسح تلقائيًّا. ده اللي مكتوب لولي الأمر في السياسات
              وفي شاشة الحجز.
            </>
          ) : (
            <>
              التسجيل <strong>مقفول</strong> في الإعدادات — فمفيش تسجيلات جديدة،
              ومفيش حذف تلقائي للقديم.
            </>
          )}
        </p>

        {/* ⚠️ **الرابط بيتولّد لحظة الضغط وبيموت بعد ساعة.**
            دي تسجيلات فيها أطفال، والرابط الدائم بيتنسخ على واتساب
            ويفضل شغّالًا بعد ما كل حد نسي إنه اتبعت — نفس سبب إن
            غرف الجلسات `private` والدخول بتذكرة. */}
        <p className="mb-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
          <AlertTriangle className="h-5 w-5 shrink-0 text-slate-400" />
          <span>
            رابط المشاهدة بيتولّد لحظة الضغط وبينتهي بعد ساعة، و
            <strong className="text-slate-800"> كل فتحة بتتسجّل في التدقيق</strong> —
            دي جلسات فيها أطفال.
            {!canDeleteRecordings && ' والحذف لمدير النظام وحده.'}
          </span>
        </p>

        {recordings && !recordings.ok ? (
          <p className="text-sm font-bold text-rose-600">{recordings.error}</p>
        ) : (
          <SimpleDataTable
            columns={[
              { header: 'الجلسة', accessorKey: 'sessionDisplay' },
              { header: 'المدرب', accessorKey: 'instructorDisplay' },
              { header: 'اتسجّل', accessorKey: 'whenDisplay' },
              { header: 'المدة', accessorKey: 'lengthDisplay' },
              { header: 'الحالة', accessorKey: 'stateDisplay' },
              { header: '', accessorKey: 'watchDisplay' },
              { header: '', accessorKey: 'deleteDisplay' },
            ]}
            data={recordingRows}
            pageSize={10}
            searchPlaceholder="ابحث باسم المتدرب أو المدرب..."
            emptyMessage={
              settings.sessionRecording.enabled
                ? 'مفيش تسجيلات لسه.'
                : 'مفيش تسجيلات — التسجيل مقفول في الإعدادات.'
            }
          />
        )}

        {settings.sessionRecording.enabled && canDeleteRecordings && (
          <div className="mt-4">
            <PurgeNowButton
              retentionLabel={retentionLabel(settings.sessionRecording.retentionDays)}
            />
          </div>
        )}
      </section>

      {/* ── القادمة ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-800">
          <CalendarClock className="h-5 w-5 text-slate-400" />
          الجلسات القادمة وغرفها
        </h2>
        <SimpleDataTable
          columns={[
            { header: 'الجلسة', accessorKey: 'sessionDisplay' },
            { header: 'المدرب', accessorKey: 'instructorDisplay' },
            { header: 'الموعد', accessorKey: 'dateDisplay' },
            { header: 'الحالة', accessorKey: 'statusDisplay' },
            { header: 'الغرفة', accessorKey: 'roomDisplay' },
            { header: 'التسجيل', accessorKey: 'recordingDisplay' },
            { header: '', accessorKey: 'joinDisplay' },
          ]}
          data={upcomingRows}
          pageSize={15}
          searchPlaceholder="ابحث باسم المتدرب أو المدرب..."
          emptyMessage="مفيش جلسات قادمة."
        />
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-800">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>}
    </div>
  );
}
