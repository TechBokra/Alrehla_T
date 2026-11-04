import { getSessions } from '@/data/domains/(shared)/sessions/queries';
import { getReviewableBookings } from '@/data/domains/(client)/reviews/queries';
import { ReviewForm } from '@/components/services/ReviewForm';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { formatCairo } from '@/lib/timezone';
import { sessionStatusView } from '@/lib/session-status';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { SessionRecordingNotice } from '@/components/SessionRecordingNotice';
import { AccountBookingsClient, type BookingRow } from './AccountBookingsClient';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [sessions, settings, content, reviewable] = await Promise.all([
    getSessions(),
    getSiteSettings(),
    getSiteContent(),
    // الباقات اللي خلصت ولسه ما اتقيّمتش.
    getReviewableBookings(),
  ]);

  const rows: BookingRow[] = sessions.map((session) => {
    const status = sessionStatusView(session.status);

    return {
      id: session.id,
      referenceDisplay: session.paymentReference ?? '—',
      sessionDisplay: `جلسة ${session.sessionNumber}`,
      dateDisplay: formatCairo(session.scheduledAt, {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
      packageDisplay: session.packageName ?? '—',
      status: session.status,
      rawScheduledAt: session.scheduledAt,
      statusLabel: status.label,
      statusClass: status.className,
    };
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="المواعيد والجلسات" />
      {/* ولي الأمر لازم يفضل شايف الإفصاح، مش يشوفه مرة وقت الحجز
          وبعدها ينساه. */}
      <SessionRecordingNotice
        enabled={settings.sessionRecording.enabled}
        retentionDays={settings.sessionRecording.retentionDays}
        template={content['recording.notice']}
      />
      {/* ══ تقييم المدرب بعد انتهاء الباقة ══════════════════
          طلب الفريق (٢٤ أكتوبر): «تقييم بعد انتهاء الباقة أو
          الخدمة، وليس خلال أو قبل».

          ⚠️ **الباقات ماكانش ليها طريق تقييم خالص.** التقييم كان
             من طلب الخدمة الإبداعية وبس، فاللي حجز باقة وخلّص
             جلساته مايقدرش يقيّم مدربه. والنتيجة: صفر تقييم في
             القاعدة، وكل صفحة مدرب بتقول «لا توجد تقييمات بعد».

          ⚠️ والكارت بيظهر **بعد آخر جلسة بس** — `bookingReviewState`
             هي اللي بتقرر، ونفس الدالة بتتفحص تاني في الأكشن قبل
             الكتابة (قاعدة «ع»: إخفاء الشاشة بيتخطّى). */}
      {reviewable.map((b) => (
        <ReviewForm
          key={b.subscriptionId}
          target={{ kind: 'booking', subscriptionId: b.subscriptionId }}
          serviceName={b.packageName}
          instructorName={b.instructorName}
        />
      ))}

      <AccountBookingsClient initialRows={rows} />
    </div>
  );
}
