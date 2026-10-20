import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { cairoTodayRange, remindersFor, type ReminderRow, type ReminderSession } from '@/lib/session-reminders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * المهمة اليومية: تذكير بجلسات النهارده (`lib/session-reminders`).
 *
 * بتشتغل الصبح بدري. بتبعت إشعار لصاحب الحجز، وحساب الطفل لو موجود،
 * والمدرب — لكل جلسة ميعادها النهارده بتوقيت القاهرة ومش ملغية ولا خلصت.
 *
 * ⚠️ **مابتكررش:** لو المهمة اشتغلت مرتين في نفس اليوم (Vercel بيعيد
 *    أحيانًا)، اللي اتبعت قبل كده النهارده بنفس الرابط مابيتبعتش تاني.
 *
 * نفس حراسة باقي المهام: من غير `CRON_SECRET` المهمة **بتقف**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('session-reminders cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isAdminApiConfigured()) {
    return NextResponse.json({ skipped: 'SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم' }, { status: 200 });
  }

  const supabase = createAdminClient();
  const { start, end } = cairoTodayRange(new Date());

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(
      'id, scheduled_at, session_number, instructor_id, course_subscriptions(user_id, child_id, creative_writing_packages(name))',
    )
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .in('status', ['scheduled', 'confirmed', 'pending']);
  if (error) {
    console.error('session-reminders: sessions query failed', error);
    return NextResponse.json({ error: 'تعذّر قراءة الجلسات' }, { status: 500 });
  }
  if (!sessions?.length) return NextResponse.json({ sessions: 0, sent: 0 });

  // الأطفال والمدربين في استعلامين بدل استعلام لكل جلسة.
  type Sub = { user_id: string; child_id: string | null; creative_writing_packages: { name: string } | null };
  const subOf = (s: (typeof sessions)[number]) => s.course_subscriptions as unknown as Sub | null;
  const childIds = [...new Set(sessions.map((s) => subOf(s)?.child_id).filter(Boolean))] as string[];
  const instructorIds = [...new Set(sessions.map((s) => s.instructor_id).filter(Boolean))] as string[];
  const [{ data: children }, { data: instructors }] = await Promise.all([
    childIds.length
      ? supabase.from('child_profiles').select('id, full_name, account_profile_id').in('id', childIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; account_profile_id: string | null }[] }),
    instructorIds.length
      ? supabase.from('instructors').select('id, user_id').in('id', instructorIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);
  const childById = new Map((children ?? []).map((c) => [c.id, c]));
  const instructorUser = new Map((instructors ?? []).map((i) => [i.id, String(i.user_id)]));

  const rows: ReminderRow[] = [];
  for (const s of sessions) {
    const sub = subOf(s);
    if (!sub) continue;
    const child = sub.child_id ? childById.get(sub.child_id) : undefined;
    const input: ReminderSession = {
      id: s.id,
      scheduledAt: s.scheduled_at,
      sessionNumber: s.session_number,
      packageName: sub.creative_writing_packages?.name ?? null,
      bookerId: String(sub.user_id),
      childId: sub.child_id,
      childName: child?.full_name ?? null,
      childAccountId: child?.account_profile_id?.trim() || null,
      instructorUserId: s.instructor_id ? instructorUser.get(s.instructor_id) ?? null : null,
    };
    rows.push(...remindersFor(input));
  }

  // اللي اتبعت النهارده قبل كده (نفس الشخص ونفس الرابط) مابيتبعتش تاني.
  const { data: already } = await supabase
    .from('notifications')
    .select('recipient_profile_id, link')
    .gte('created_at', start.toISOString())
    .like('title', 'تذكير:%');
  const sent = new Set((already ?? []).map((n) => `${n.recipient_profile_id}|${n.link}`));
  const fresh = rows.filter((r) => !sent.has(`${r.recipient_profile_id}|${r.link}`));

  if (fresh.length > 0) {
    const { error: insertError } = await supabase.from('notifications').insert(fresh);
    if (insertError) {
      console.error('session-reminders: insert failed', insertError);
      return NextResponse.json({ error: 'تعذّر إرسال التذكيرات' }, { status: 500 });
    }
  }
  return NextResponse.json({ sessions: sessions.length, sent: fresh.length });
}
