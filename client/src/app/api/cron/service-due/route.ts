import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { getProviderUserId, getInstructorUserId } from '@/lib/notifications';
import { SERVICE_DUE_WARNING_DAYS, OPEN_SERVICE_STATUSES } from '@/lib/service-delivery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * المهمة اليومية: إشعارات مهلة التسليم.
 *
 * بتشتغل مرة في اليوم من جدولة Vercel (شوف vercel.json). بتدوّر على
 * الطلبات اللي لسه مستنّية تسليم وبتبعت إشعارين:
 *   • تنبيه قبل المهلة بـ3 أيام
 *   • تنبيه عند تجاوز المهلة
 *
 * **مفيش إجراء تلقائي على الطلب نفسه.** الإشعار بيقول للطرفين، والقرار
 * لإنسان: إلغاء طلب تلقائيًا ممكن يلغي شغل خلص واتأخر تسليمه يوم واحد.
 *
 * كل إشعار بيتبعت **مرة واحدة**: العمودين `due_warned_at` و
 * `due_overdue_notified_at` بيمنعوا التكرار اليومي. من غيرهم مقدّم
 * الخدمة هياخد نفس الرسالة كل يوم لحد ما يسلّم.
 *
 * الصلاحيات: المهمة دي بتقرا طلبات كل الناس، فبتستخدم مفتاح الخدمة —
 * مفيش مستخدم مسجّل دخوله وقت تشغيلها. ولأن ده المفتاح اللي بيتخطى كل
 * قواعد الحماية، الطلب نفسه لازم يثبت إنه جاي من الجدولة.
 *
 * الإشعارات هنا بتتكتب **مباشرة** في الجدول، مش من خلال دالة
 * `notify_user`. الدالة دي بتتأكد إن المُرسِل طرف في الطلب أو إداري —
 * والمهمة مالهاش مُرسِل أصلًا، فالدالة كانت هترفض. مفتاح الخدمة بيتخطى
 * الحماية بحكم طبيعته، فالكتابة المباشرة هي الصح هنا؛ والبديل كان
 * توسيع الدالة عشان تقبل استدعاء بلا مستخدم — وده باب أوسع من اللازم.
 */
export async function GET(request: Request) {
  // Vercel بتبعت المفتاح ده مع كل تشغيل. من غير الفحص ده أي حد يعرف
  // الرابط يقدر يشغّل المهمة ويبعت إشعارات للناس.
  //
  // ⚠️ الفحص ده كان مكتوب `if (secret) { ... }` — يعني لو المتغير مش
  //    متظبط على الخادم، الشرط كله بيتخطى والمسار بيفضل **مفتوح**.
  //    والمتغير فعلًا لسه مش متظبط (دفتر الحالة §7، «مؤجَّل بقرار»)،
  //    فالمسار ده كان مكشوف على الإنتاج.
  //
  //    ودي بالظبط المصيدة اللي في قاعدة (ك): حارس بيفشل **مفتوحًا**.
  //    شكله حارس، وبيدّي إحساس إن الموضوع متأمّن، وهو مش شغّال أصلًا.
  //    الغياب لازم يوقف العملية، مش يعدّيها.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('service-due cron: CRON_SECRET غير موجود على الخادم');
    return NextResponse.json(
      { error: 'CRON_SECRET غير مضبوط على الخادم — المهمة متوقفة' },
      { status: 503 },
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isAdminApiConfigured()) {
    // مش خطأ في الكود: المفتاح مش متظبط على الخادم.
    return NextResponse.json(
      { skipped: 'SUPABASE_SERVICE_ROLE_KEY غير موجود على الخادم' },
      { status: 200 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const warnFrom = new Date(
    now.getTime() + SERVICE_DUE_WARNING_DAYS * 24 * 60 * 60 * 1000,
  );

  const { data: orders, error } = await supabase
    .from('service_orders')
    .select(
      'id, buyer_profile_id, instructor_id, provider_id, due_at, status, due_warned_at, due_overdue_notified_at, standalone_services(name)',
    )
    .in('status', [...OPEN_SERVICE_STATUSES])
    .not('due_at', 'is', null)
    .lte('due_at', warnFrom.toISOString());

  if (error) {
    console.error('service-due cron: query failed', error);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  let warned = 0;
  let overdue = 0;

  for (const order of orders ?? []) {
    const isLate = new Date(order.due_at as string).getTime() < now.getTime();

    // متأخر واتبعتله تنبيه تأخير قبل كده، أو لسه في مهلته واتنبّه —
    // ما نكررش.
    if (isLate && order.due_overdue_notified_at) continue;
    if (!isLate && order.due_warned_at) continue;

    const serviceName =
      (order.standalone_services as unknown as { name: string } | null)?.name ??
      'خدمة إبداعية';

    const providerUserId = order.provider_id
      ? await getProviderUserId(order.provider_id)
      : order.instructor_id
        ? await getInstructorUserId(order.instructor_id)
        : null;

    const title = isLate ? 'تجاوز مهلة التسليم' : 'اقتراب موعد التسليم';
    const forProvider = isLate
      ? `طلب «${serviceName}» تجاوز مهلة التسليم. سلّم أو تواصل مع العميل داخل الطلب.`
      : `باقي أيام قليلة على موعد تسليم طلب «${serviceName}».`;
    const forBuyer = isLate
      ? `طلب «${serviceName}» تجاوز موعد التسليم المتفق عليه. تواصل معنا إذا لم يصلك رد.`
      : `اقترب موعد تسليم طلب «${serviceName}».`;

    const rows = [
      {
        recipient_profile_id: order.buyer_profile_id,
        title,
        message: forBuyer,
        link: `/account/orders/creative-writing/${order.id}`,
      },
    ];
    // المنصة كمقدّم مالهاش حساب شخص — الطلب بيظهر في لوحة الإدارة.
    if (providerUserId) {
      rows.push({
        recipient_profile_id: providerUserId,
        title,
        message: forProvider,
        link: `/dashboard/provider/orders/${order.id}`,
      });
    }

    const { error: notifyError } = await supabase.from('notifications').insert(rows);
    if (notifyError) {
      // الإشعار مش حِمل أساسي: بنسجّل وبنكمّل بدل ما نوقف المهمة كلها
      // على طلب واحد.
      console.error('service-due cron: notify failed', order.id, notifyError);
      continue;
    }

    await supabase
      .from('service_orders')
      .update(
        isLate
          ? { due_overdue_notified_at: now.toISOString() }
          : { due_warned_at: now.toISOString() },
      )
      .eq('id', order.id);

    if (isLate) overdue += 1;
    else warned += 1;
  }

  return NextResponse.json({ checked: orders?.length ?? 0, warned, overdue });
}
