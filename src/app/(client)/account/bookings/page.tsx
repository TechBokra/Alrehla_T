import { getSessions } from '@/data/domains/writing';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { formatCairo } from '@/lib/timezone';
import { sessionStatusView } from '@/lib/session-status';
import { getSiteSettings, getSiteContent } from '@/data/domains/content';
import { SessionRecordingNotice } from '@/components/SessionRecordingNotice';
import { AccountBookingsClient, type BookingRow } from './AccountBookingsClient';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [sessions, settings, content] = await Promise.all([
    getSessions(),
    getSiteSettings(),
    getSiteContent(),
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
      <AccountBookingsClient initialRows={rows} />
    </div>
  );
}
