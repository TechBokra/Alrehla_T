import { NextResponse } from 'next/server';
import { runChildPhotoCleanup } from '@/data/domains/(admin)/files/child-photo-cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * المهمة اليومية: مسح صور الأطفال اللي خلصت مدتها.
 *
 * ⚠️ **مهمة منفصلة عن `private-files` عن قصد.** التانية بتمسح
 *    ملفات مسجّلة في جدول، ودي بتفحص بيانات الطلبات نفسها. ولو
 *    واحدة فشلت، التانية بتكمّل — ومسح صور الأطفال وعد لولي الأمر،
 *    فماينفعش يتعلّق على فشل مهمة تانية.
 *
 * ⚠️ ونفس حراسة باقي المهام: من غير `CRON_SECRET` المهمة **بتقف**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('child-photos cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json(
      { error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' },
      { status: 503 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runChildPhotoCleanup();
  if (!result.ok) {
    console.error('child-photos cron failed', result.error);
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
