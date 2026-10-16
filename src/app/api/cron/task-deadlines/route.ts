import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';

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

  const { data, error } = await admin.rpc('work_tasks_deadline_sweep');
  if (error) {
    console.error('task-deadlines cron failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ...((data ?? {}) as Record<string, unknown>), box: boxRes.data ?? null });
}
