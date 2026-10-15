import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { WeeklySlot } from '@/types';
import { createSessionsForSubscription } from '@/lib/bookings/create-sessions';
import { getInstructorUserId, getProviderUserId, notifyUser } from '@/lib/notifications';

/**
 * اللي لازم يحصل **بعد** ما الدفع يتأكد — غير قلب الحالة في القاعدة.
 *
 * ── ليه الملف ده موجود ──────────────────────────────────────
 *
 * 🔴 **تأكيد دفع الحجز مش بيقلب حالة وبس — هو اللي بيولّد الجلسات.**
 *
 * الإدارة لما بتأكّد تحويلًا بنكيًّا، الكود بيعمل حاجتين: يخلّي الاشتراك
 * «نشط»، **وبعدين يعمل جلسات الباقة ويحجز غرفها**. لو الويبهوك اكتفى
 * بتحديث الصف في القاعدة، العميل كان هيدفع بالبطاقة ويلاقي حجزًا نشطًا
 * **بلا ولا جلسة واحدة** — لا في لوحته ولا في لوحة المدرب. فلوس وصلت
 * وسكوت تام، وهو أسوأ شكل للعطل: كل حاجة شكلها تمام.
 *
 * ونفس الحكاية في الخدمات: التأكيد بيحسب `due_at` — **مهلة مقدّم
 * الخدمة** — وبيبعت إشعارين. من غيرها الطلب بيوصل للمقدّم بلا مهلة،
 * وتقارير التأخير بتبقى غلط.
 *
 * فالقاعدة بتسجّل الدفعة وتقفل التكرار وتتحقق من المبلغ، **والدوال دي
 * بتكمّل باقي الشغل** — بنفس المنطق اللي اللوحة بتناديه بالظبط.
 *
 * ⚠️ **ولا واحدة منهم بترمي.** الفلوس وصلت خلاص؛ فشل التجهيز مشكلة
 *    تتصلّح من اللوحة، مش سبب نرجّع بيه خطأ للبوابة فتفضل تعيد إرسال
 *    حدث اتعالج.
 */

/** المدة اللي مقدّم الخدمة لازم يسلّم فيها — نفس رقم `confirmServiceOrderPayment`. */
const SERVICE_DUE_DAYS = 7;

export type AfterPaymentResult = { ok: boolean; note?: string };

/**
 * خدمة كتابة اتدفعت بالبوابة: مهلة التسليم + إشعار الطرفين.
 *
 * الحالة بقت `paid` من `record_gateway_payment_cw` قبل ما نوصل هنا.
 */
export async function afterServiceOrderPaid(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<AfterPaymentResult> {
  try {
    // المهلة بتبدأ من تأكيد الدفع مش من إنشاء الطلب: قبل الدفع مفيش
    // التزام على مقدّم الخدمة أصلًا.
    const dueAt = new Date(Date.now() + SERVICE_DUE_DAYS * 24 * 60 * 60 * 1000);
    const { error: dueError } = await supabase
      .from('service_orders')
      .update({ due_at: dueAt.toISOString() })
      .eq('id', orderId)
      .is('due_at', null);
    if (dueError) console.error('تعذّر ضبط مهلة التسليم بعد الدفع', dueError);

    const { data: order } = await supabase
      .from('service_orders')
      .select('buyer_profile_id, instructor_id, provider_id')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return { ok: false, note: 'الطلب مش موجود بعد تسجيل الدفع' };

    await notifyUser({
      event: 'order_status',
      recipientProfileId: order.buyer_profile_id,
      title: 'تم تأكيد دفعك',
      message: 'استلمنا المبلغ، والمدرب سيبدأ التنفيذ.',
      link: `/account/orders/creative-writing/${orderId}`,
    });

    const providerUserId = order.provider_id
      ? await getProviderUserId(order.provider_id)
      : order.instructor_id
        ? await getInstructorUserId(order.instructor_id)
        : null;

    if (providerUserId) {
      await notifyUser({
        event: 'service_order_new',
        recipientProfileId: providerUserId,
        title: 'طلب جاهز للتنفيذ',
        message: `تم تأكيد الدفع — يمكنك بدء التنفيذ الآن. المهلة ${SERVICE_DUE_DAYS} يومًا.`,
        link: `/dashboard/provider/orders/${orderId}`,
      });
    }

    return { ok: true };
  } catch (error) {
    console.error('فشل تجهيز طلب الخدمة بعد الدفع', orderId, error);
    return { ok: false, note: 'الدفع اتسجّل والتجهيز فشل' };
  }
}

/**
 * حجز باقة اتدفع بالبوابة: **توليد الجلسات** + إشعار العميل.
 *
 * ⚠️ الإشعار بيتبعت في الحالتين — لو الجدولة فشلت، العميل لازم يعرف إن
 *    دفعه وصل بدل ما يفضل مستني في صمت. (نفس الدرس المكتوب في
 *    `confirmBookingPayment`.)
 */
export async function afterCourseBookingPaid(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<AfterPaymentResult> {
  try {
    const { data: sub } = await supabase
      .from('course_subscriptions')
      .select('id, user_id, package_id, preferred_instructor_id, preferred_slot')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (!sub) return { ok: false, note: 'الاشتراك مش موجود بعد تسجيل الدفع' };

    const sessionsCreated = await createSessionsForSubscription(supabase, {
      subscriptionId: sub.id,
      packageId: sub.package_id,
      instructorId: sub.preferred_instructor_id ?? null,
      preferredSlot: (sub.preferred_slot as WeeklySlot | null) ?? null,
    });

    await notifyUser({
      event: 'session_update',
      recipientProfileId: sub.user_id,
      title: sessionsCreated > 0 ? 'اتأكد دفعك — جلساتك جاهزة' : 'اتأكد دفعك',
      message:
        sessionsCreated > 0
          ? `اتعمل ${sessionsCreated} جلسة بمواعيد مبدئية. هنتواصل معاك لتثبيتها.`
          : 'استلمنا دفعك وسجّلنا اشتراكك. المواعيد هنرتّبها ونتواصل معاك.',
      link: '/account/subscriptions/course',
    });

    return sessionsCreated > 0
      ? { ok: true }
      : { ok: false, note: 'الدفع اتسجّل ومفيش جلسات اتعملت — محتاج جدولة بالإيد' };
  } catch (error) {
    console.error('فشل تجهيز الحجز بعد الدفع', subscriptionId, error);
    return { ok: false, note: 'الدفع اتسجّل والتجهيز فشل' };
  }
}
