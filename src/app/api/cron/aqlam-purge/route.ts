import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * المهمة اليومية: مسح نصوص وتعليقات أقلام الرحلة اللي اتشالت من أكتر من
 * مدة الاحتفاظ المضبوطة من إعدادات أقلام الرحلة (الافتراضي ٧ أيام)، ومعاها تشجيعاتها ونسخ تعديلها وبلاغاتها.
 * سجل العقوبات مابيتمسحش. المخفي (مش مشال) مابيتمسحش.
 *
 * نفس حراسة باقي المهام: من غير `CRON_SECRET` المهمة **بتقف**.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('aqlam-purge cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isAdminApiConfigured()) {
    console.error('aqlam-purge cron: SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم');
    return NextResponse.json({ error: 'مفتاح الخدمة غير مضبوط على الخادم — المهمة متوقفة' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('aqlam_purge_removed');
  // من غير `p_days`: الدالة بتقرا المدة من إعدادات الإدارة.
  if (error) {
    console.error('aqlam-purge cron failed', error);
    return NextResponse.json({ error: 'تعذّر مسح المحذوف' }, { status: 500 });
  }
  return NextResponse.json(data);
}
