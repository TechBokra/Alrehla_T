import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { adminAlertEmails, sendEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/site-url';
import { joinFollowUp, joinFollowUpDigest, lastMessages } from '@/lib/join-followup';

const LINE_LABELS: Record<string, string> = {
  studio: 'الاستوديو (قصص أنت البطل)',
  enha_lak: 'طلبات إنها لك',
  box: 'شحنات صندوق الرحلة',
  services: 'الخدمات',
  courses: 'الكورسات والجلسات',
  certificates: 'شهادات الإتمام',
  support: 'تذاكر الدعم',
  channels: 'واتساب والإيميل',
  join: 'طلبات الانضمام',
  blog: 'خطة المدونة',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * شبكة أمان يومية لمواعيد المهام: بتبعت إشعارات «قرّب موعدها» و«فات موعدها» لو محدّش فتح
 * صفحة المهام (الفحص بيشتغل كمان لما أي إداري يفتحها، مرة كل ١٠ دقايق على الأكتر).
 * الفحص نفسه بيضمن إن كل إشعار يتبعت مرة واحدة بس لكل مهمة. وبيفتح مهام الشحنات الشهرية للصندوق
 * اللي موعدها قرّب (`box_shipment_tasks_sync`).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('task-deadlines cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isAdminApiConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم' }, { status: 503 });
  }

  const admin = createAdminClient();
  // مهام الشحنات الشهرية للصندوق الأول (تتفتح قبل موعدها)، وبعدها فحص المواعيد. فشل الأولى مايوقفش التانية.
  const boxRes = await admin.rpc('box_shipment_tasks_sync');
  if (boxRes.error) console.error('task-deadlines cron: box shipments', boxRes.error.message);
  // مهمة اليوم لكل قناة تواصل ليها مسؤول (ملف 20261107100000). قبل تشغيل الملف الدالة مش موجودة — بنكمّل.
  const channelsRes = await admin.rpc('work_channels_daily');
  if (channelsRes.error) console.error('task-deadlines cron: channels', channelsRes.error.message);

  const { data, error } = await admin.rpc('work_tasks_deadline_sweep');
  if (error) {
    console.error('task-deadlines cron failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // ══ الملخّص اليومي (خريطة البيانات، ٢٧ أكتوبر) ══════════════
  //
  // ⚠️ إشعار «فات الموعد» بيتبعت مرة واحدة جوّه اللوحة — ولو محدش فتحها،
  //    الطابور بيقف في صمت (29 مهمة متأخرة يوم ٢٧ أكتوبر). الملخّص ده بيوصل
  //    الإيميل كل يوم طول ما فيه متأخر.
  let digest: unknown = null;
  try {
    const { data: open } = await admin
      .from('work_tasks')
      .select('line, due_at, assignee_ids, created_at')
      .eq('status', 'open')
      .limit(2000);
    const now = Date.now();
    const rows = open ?? [];
    const overdue = rows.filter((t) => t.due_at && Date.parse(t.due_at) < now);
    const unassigned = rows.filter((t) => !t.assignee_ids || t.assignee_ids.length === 0);
    if (overdue.length > 0 || unassigned.length > 0) {
      const byLine = new Map<string, number>();
      for (const t of overdue) byLine.set(t.line, (byLine.get(t.line) ?? 0) + 1);
      const oldest = overdue.reduce<number | null>((m, t) => {
        const d = Date.parse(t.due_at as string);
        return m === null || d < m ? d : m;
      }, null);
      const days = oldest ? Math.floor((now - oldest) / 86_400_000) : 0;
      const to = await adminAlertEmails();
      digest = await sendEmail({
        to,
        subject: `ملخّص الشغل: ${overdue.length} مهمة متأخرة`,
        lines: [
          `فيه ${overdue.length} مهمة مفتوحة عدّت ميعادها${days > 0 ? `، أقدمها متأخرة ${days} يوم` : ''}.`,
          ...[...byLine.entries()].map(([line, n]) => `• ${LINE_LABELS[line] ?? line}: ${n}`),
          unassigned.length > 0
            ? `و${unassigned.length} مهمة مالهاش مسؤول — حدّد الناس من «توزيع المهام».`
            : '',
          'الإيميل ده بيوصل كل صباح طول ما فيه متأخر.',
        ].filter(Boolean),
        link: { href: `${SITE_URL}/dashboard/admin/tasks`, label: 'افتح المهام' },
      });
    }
  } catch (e) {
    console.error('task-deadlines cron: digest', e);
  }

  // ══ متابعة طلبات الانضمام (طلب تامر، ١ نوفمبر) ══════════════
  //
  // الطلب اللي حصل فيه تواصل مابقاش «طلب» في الرئيسية. لو اتأخر الرد
  // (مننا أو من المتقدّم) بيوصل إشعار واحد في اليوم للإدارة.
  let joinDigest: unknown = null;
  try {
    const { data: reqs } = await admin
      .from('join_requests')
      .select('id, status, created_at')
      .eq('status', 'pending')
      .limit(500);
    const open = reqs ?? [];
    if (open.length > 0) {
      const { data: msgs } = await admin
        .from('join_request_messages')
        .select('request_id, author, created_at')
        .in('request_id', open.map((r) => r.id));
      const last = lastMessages(msgs ?? []);
      const digest = joinFollowUpDigest(
        open.map((r) => joinFollowUp({ status: r.status, createdAt: r.created_at }, last.get(r.id) ?? null)),
      );
      if (digest) {
        const { data: admins } = await admin
          .from('user_profiles')
          .select('id')
          .in('role', ['super_admin', 'general_supervisor']);
        const rows = (admins ?? []).map((a) => ({
          recipient_profile_id: a.id,
          title: digest.title,
          message: digest.message,
          link: '/dashboard/admin/join-requests?filter=action',
        }));
        if (rows.length > 0) {
          const { error: nErr } = await admin.from('notifications').insert(rows);
          if (nErr) console.error('task-deadlines cron: join digest', nErr.message);
        }
        joinDigest = { ...digest, recipients: rows.length };
      }
    }
  } catch (e) {
    console.error('task-deadlines cron: join follow-ups', e);
  }

  // ══ الحفظ: الإشعارات المقروءة القديمة + أرشفة السجل ═══════════
  const retention = await admin.rpc('ops_retention_sweep');
  if (retention.error && retention.error.code !== 'PGRST202') {
    console.error('task-deadlines cron: retention', retention.error.message);
  }

  return NextResponse.json({
    ...((data ?? {}) as Record<string, unknown>),
    box: boxRes.data ?? null,
    digest,
    joinDigest,
    retention: retention.data ?? null,
  });
}
