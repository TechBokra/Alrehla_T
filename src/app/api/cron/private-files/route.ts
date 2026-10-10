import { NextResponse } from 'next/server';
import { runPrivateFilesCleanup } from '@/data/domains/private-files-cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * المهمة اليومية: مسح ملفات الطلبات ومساحة الكتابة اللي مدتها خلصت
 * (ملف 20 — المدة من «الإعدادات العامة»).
 *
 * نفس حراسة باقي المهام: من غير `CRON_SECRET` المهمة **بتقف**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('private-files cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runPrivateFilesCleanup();
  if (!result.ok) {
    console.error('private-files cron failed', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ checked: result.checked, deleted: result.deleted });
}
