import { NextResponse } from 'next/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { readXpayConfig } from '@/lib/payments/xpay-client';
import { verifyXpaySignature } from '@/lib/payments/xpay-signature';
import { isHandledEvent, parseXpayEvent, type PaymentKind } from '@/lib/payments/xpay-event';
import {
  afterCourseBookingPaid,
  afterServiceOrderPaid,
} from '@/lib/payments/after-gateway-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * ويبهوك XPay — **المصدر الوحيد لتأكيد الدفع**.
 *
 * ── ليه مش صفحة النجاح ──────────────────────────────────────
 *
 * بعد الدفع، XPay بتحوّل العميل لرابط نجاح على موقعنا. الرابط ده **مش
 * دليل**: أي حد يقدر يفتحه بنفسه من غير ما يدفع. لو اعتمدنا عليه، أي
 * زائر ياخد المنتج ببلاش. فصفحة النجاح بتقول «بنأكّد دفعتك» وبس،
 * والتأكيد الحقيقي بيجي من هنا.
 *
 * ── طبقات الحماية ───────────────────────────────────────────
 *
 * ١. التوقيع: HMAC على الجسم الخام بمفتاح `whsec_` (xpay-signature.ts).
 * ٢. منع التكرار: كل حدث برقمه في `payment_events`، وإعادة الإرسال
 *    بتترجع «duplicate» من غير ما تتعالج تاني.
 * ٣. المبلغ: القاعدة بتقارنه بإجمالي الطلب، والاختلاف بيمنع التأكيد.
 * ٤. الصلاحية: `record_gateway_payment` مسموح بيها لـ`service_role` بس.
 *
 * ⚠️ **بنرد 200 حتى على حدث مرفوض** (مبلغ غلط، طلب مش موجود). الرفض
 *    اتسجّل في `payment_events` وإعادة الإرسال مش هتصلّحه، فالرد بخطأ
 *    بيخلّي XPay تفضل تعيد المحاولة للأبد على حاجة مش هتتصلّح.
 *    بنرد بخطأ بس لو العيب **عندنا** (القاعدة مش متاحة) عشان تعيد.
 */
/**
 * النوع من القاعدة لما البوابة ماترجّعوش.
 *
 * ⚠️ **الويبهوك مايعتمدش على `metadata` وحدها.** إحنا بنحط `kind` وقت
 *    فتح الجلسة، بس مفيش ضمان إنها ترجع: جلسة اتفتحت قبل ما الخانة
 *    تتعرّف مالهاش، والبوابة ممكن تهمل مفتاحًا ماتعرفهوش. والبديل هنا
 *    مضمون لأن الأرقام UUID — الرقم موجود في جدول واحد لا غير.
 *
 * القراءة بمفتاح الخدمة (الويبهوك مالوش جلسة مستخدم)، فالـRLS
 * مابتحجبش الصف.
 */
async function resolveKind(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  fromMetadata: PaymentKind,
): Promise<PaymentKind | null> {
  // جه صريح من البوابة؟ نثق فيه — هو اللي إحنا بعتناه.
  if (fromMetadata !== 'order') return fromMetadata;

  const inOrders = await admin.from('orders').select('id').eq('id', id).maybeSingle();
  if (inOrders.data) return 'order';

  const inServices = await admin.from('service_orders').select('id').eq('id', id).maybeSingle();
  if (inServices.data) return 'service_order';

  const inCourses = await admin
    .from('course_subscriptions')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (inCourses.data) return 'course_subscription';

  return null;
}

export async function POST(request: Request) {
  const config = readXpayConfig();
  if (!config) {
    console.error('xpay webhook: مفاتيح البوابة غير مضبوطة على الخادم');
    return NextResponse.json({ error: 'gateway not configured' }, { status: 503 });
  }

  // ⚠️ النص الخام قبل أي تحليل: `request.json()` بيعيد بناء الجسم
  //    والتوقيع بيفشل.
  const rawBody = await request.text();

  const signature = verifyXpaySignature(
    rawBody,
    request.headers.get('xpay-signature'),
    config.webhookSecret,
    Math.floor(Date.now() / 1000),
  );
  if (!signature.ok) {
    console.warn('xpay webhook: توقيع مرفوض', signature.reason);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const event = parseXpayEvent(parsedBody);
  if (!event) {
    console.warn('xpay webhook: جسم الحدث غير مفهوم');
    return NextResponse.json({ received: true, outcome: 'unparsable' });
  }

  if (!isHandledEvent(event.type)) {
    return NextResponse.json({ received: true, outcome: 'ignored_type' });
  }

  if (!event.orderId) {
    console.warn('xpay webhook: حدث بلا رقم طلب', event.id, event.type);
    return NextResponse.json({ received: true, outcome: 'no_order' });
  }

  if (!isAdminApiConfigured()) {
    console.error('xpay webhook: SUPABASE_SERVICE_ROLE_KEY غير موجود');
    return NextResponse.json({ error: 'server not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();

  // النوع من البوابة لو بعتته، وإلا من القاعدة — الجلسات القديمة
  // مافيهاش `kind`، ومفيش ضمان إن البوابة ترجّع مفتاحًا ماتعرفهوش.
  const kind = await resolveKind(supabase, event.orderId, event.kind);
  if (!kind) {
    console.error('xpay webhook: رقم مش موجود في أي جدول', event.id, event.orderId);
    return NextResponse.json({ received: true, outcome: 'unknown_source' });
  }

  // ── خدمة كتابة أو حجز باقة ────────────────────────────────
  //
  // ⚠️ **مش مجرد دالة تانية.** الدالة بتسجّل الدفعة وبس؛ اللي بعدها
  //    (`afterCourseBookingPaid`) هو اللي **بيولّد جلسات الباقة**
  //    ويحجز غرفها، و(`afterServiceOrderPaid`) بيحسب مهلة مقدّم
  //    الخدمة. من غيرهم العميل بيدفع بالبطاقة ويلاقي حجزًا «نشطًا»
  //    بلا ولا جلسة — نفس اللي تأكيد الدفع اليدوي بيعمله من اللوحة.
  if (kind !== 'order') {
    const { data, error } = await supabase.rpc('record_gateway_payment_cw', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_kind: kind,
      p_id: event.orderId,
      p_session_id: event.sessionId,
      p_intent_id: event.intentId,
      p_amount_minor: event.amountMinor,
      p_method: event.method,
      p_payload: parsedBody as never,
    });

    if (error) {
      console.error('xpay webhook: فشل تسجيل الدفع', event.id, error);
      return NextResponse.json({ error: 'could not record payment' }, { status: 500 });
    }

    const outcome = (data as { outcome?: string } | null)?.outcome ?? 'unknown';
    if (outcome !== 'paid') {
      if (outcome === 'amount_mismatch' || outcome === 'order_not_found') {
        console.error('xpay webhook: حدث مرفوض', event.id, outcome);
      }
      return NextResponse.json({ received: true, outcome });
    }

    const after =
      kind === 'course_subscription'
        ? await afterCourseBookingPaid(supabase, event.orderId)
        : await afterServiceOrderPaid(supabase, event.orderId);

    // ⚠️ **الرد 200 حتى لو التجهيز فشل**: الدفعة اتسجّلت وإعادة إرسال
    //    الحدث هترجع 'duplicate' من غير ما تصلّح حاجة. الفشل بيتسجّل
    //    عشان الإدارة تكمّل بالإيد.
    if (!after.ok) console.error('xpay webhook: التجهيز بعد الدفع فشل', event.id, after.note);
    return NextResponse.json({ received: true, outcome, prepared: after.ok });
  }

  const { data, error } = await supabase.rpc('record_gateway_payment', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: event.orderId,
    p_session_id: event.sessionId,
    p_intent_id: event.intentId,
    p_amount_minor: event.amountMinor,
    p_method: event.method,
    // ⚠️ بنحفظ الحدث كامل للتشخيص. مفيش بيانات بطاقة في جسم الويبهوك —
    //    البوابة مابتبعتش أرقام البطاقات أصلًا.
    p_payload: parsedBody as never,
  });

  if (error) {
    // العيب عندنا: نرد بخطأ عشان XPay تعيد المحاولة.
    console.error('xpay webhook: فشل تسجيل الدفع', event.id, error);
    return NextResponse.json({ error: 'could not record payment' }, { status: 500 });
  }

  const outcome = (data as { outcome?: string } | null)?.outcome ?? 'unknown';
  if (outcome === 'amount_mismatch' || outcome === 'order_not_found') {
    // اتسجّل في payment_events — الإدارة تشوفه. وإعادة المحاولة مش هتصلّحه.
    console.error('xpay webhook: حدث مرفوض', event.id, outcome);
  }

  return NextResponse.json({ received: true, outcome });
}
