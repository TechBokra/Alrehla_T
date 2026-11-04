import { NextResponse } from 'next/server';
import { runMediaCleanup } from '@/data/domains/(admin)/media/cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// فحص ٢٣ جدول + قايمة Cloudinary — ممكن ياخد أكتر من الافتراضي.
// ⚠️ 300 (كانت 60): القايمة بقت لحد 10 آلاف صورة على صفحات (٢٧ أكتوبر).
export const maxDuration = 300;

/**
 * المهمة اليومية: مسح الصور المتسابة (`lib/media-cleanup`).
 *
 * نفس حراسة باقي المهام: من غير `CRON_SECRET` المهمة **بتقف**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('media-cleanup cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runMediaCleanup();
  if (!result.ok) {
    console.error('media-cleanup cron failed', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    tracked: result.tracked,
    deleted: result.deleted.length,
    skipped: result.skipped ?? null,
  });
}
