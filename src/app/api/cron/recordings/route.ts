import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { getSiteSettings } from '@/data/domains/content';
import { isDailyConfigured } from '@/lib/daily';
import { purgeExpiredRecordings } from '@/lib/recording-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * المهمة اليومية: حذف تسجيلات الجلسات اللي عدّت مدة الاحتفاظ.
 *
 * ── ليه المسار ده موجود ─────────────────────────────────────
 *
 * صفحة السياسات وشاشة الحجز بيقولوا لولي الأمر بالنص إن الجلسة
 * بتتسجّل وإن التسجيل **بيتمسح بعد مدة**. من غير المسار ده الجملة
 * دي وعد مكسور: التسجيل فيه ابنه بيفضل مخزَّنًا عند Daily للأبد،
 * وإحنا اللي كتبنا إنه مش هيفضل.
 *
 * ⚠️ **والمهمة دي بتحذف بلا تراجع ومحدّش بيبصّ عليها.** فكل قرار
 *    الاختيار في `expiredRecordings`، واختباراته بتتأكّد من اللي
 *    **مابيتحذفش** أكتر من اللي بيتحذف: برّه بادئة `alrehla-` ·
 *    بلا تاريخ بداية · لسه بيتسجّل · مدة احتفاظ صفر.
 *
 * ── الحارس ──────────────────────────────────────────────────
 *
 * ⚠️ **غياب `CRON_SECRET` بيوقف المهمة بـ503، مابيعدّيهاش.** الحارس
 *    اللي بيفشل مفتوحًا شكله حارس وهو مش شغّال — ودي نفس المصيدة
 *    اللي وقعنا فيها في `service-due` وكان بيخلّي المسار مكشوفًا
 *    على الإنتاج. وهنا الأثر أتقل: المسار ده **بيمسح**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('recordings cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json(
      { error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' },
      { status: 503 },
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isDailyConfigured()) {
    return NextResponse.json({ skipped: 'DAILY_API_KEY غير موجود على الخادم' });
  }

  const settings = await getSiteSettings();

  // ⚠️ **التسجيل مقفول = مفيش حذف.** لو الإعداد اتقفل، الأصل إن مفيش
  //    تسجيلات جديدة — واللي فات بيفضل لحد ما الإدارة تقرّر. المهمة
  //    مش المكان اللي بيفسّر نيّة إعداد.
  if (!settings.sessionRecording.enabled) {
    return NextResponse.json({ skipped: 'التسجيل مقفول في الإعدادات' });
  }

  const retentionDays = settings.sessionRecording.retentionDays;
  const result = await purgeExpiredRecordings({ retentionDays });

  if (!result.ok) {
    console.error('recordings cron: purge failed', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // ⚠️ **السجل بيتكتب بمفتاح الخدمة مباشرةً.** `logAuditAction`
  //    بتكتب بجلسة المستخدم، وسياسة `audit_logs` بتطلب إداريًّا أو
  //    صاحب الصف — والمهمة **مالهاش مستخدم أصلًا**، فالكتابة كانت
  //    هتترفض وترجع فاضية (قاعدة «ك») والحذف يحصل بلا أي أثر.
  if (isAdminApiConfigured() && result.data.deleted.length > 0) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_logs').insert({
      actor_profile_id: null,
      action: 'حذف تسجيلات منتهية (مهمة يومية)',
      entity_type: 'session',
      entity_id: null,
      // بأرقام التسجيلات وغرفها، مش بعددها: ده الأثر الوحيد اللي
      // هيفضل لو حد دوّر على تسجيل ملقهوش.
      metadata: {
        retentionDays,
        recordingIds: result.data.deleted,
        rooms: result.data.rooms,
        failed: result.data.failed,
      } as never,
    });
    if (error) console.error('recordings cron: audit write failed', error);
  }

  return NextResponse.json({
    scanned: result.data.scanned,
    deleted: result.data.deleted.length,
    failed: result.data.failed,
    retentionDays,
  });
}
