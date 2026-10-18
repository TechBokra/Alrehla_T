import { METHOD_LABELS, type GatewayMethod } from '@/lib/payments/settings';

/**
 * خطوات «إزاي بتشتغل؟» — مصدر واحد للنص، ومربوط بإعداد الدفع الحقيقي.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * ⚠️ **الخطوة التانية كانت مكتوبة بالإيد: «ادفع بالتحويل — إنستاباي أو
 *    فودافون كاش، وارفع صورة الإيصال».**
 *
 *    وده كان صح وقت ما اتكتب. بس بوابة الدفع بقت مفتوحة (`payments`
 *    في `site_settings`: `provider = xpay`)، والعميل بيدفع بفيزا أو
 *    فوري أو فاليو — **ومفيش إيصال يرفعه أصلًا**. فأول حاجة بيقراها
 *    على الصفحة بتوصف نظامًا اتغيّر.
 *
 *    والنص المكتوب بالإيد عمره ما يعرف إن الإعداد اتغيّر. فالخطوات
 *    بقت بتتولّد من نفس الإعداد اللي شاشة الدفع بتقرا منه: تامر يقفل
 *    البوابة من اللوحة، والخطوة بترجع تقول «تحويل» لوحدها.
 *
 * ⚠️ **وصفحة الخدمة بتتخزّن ساعة** (`revalidate = 3600`). فلو الإعداد
 *    اتغيّر، النص بياخد لحد ساعة يلحق. مقبول: شاشة الدفع نفسها
 *    بتتولّد وقت الطلب وبتقول الصح فورًا — ده وصف للمسار، مش وعد
 *    بسعر ولا بوسيلة.
 */

export type ServiceStep = { icon: 'pen' | 'pay' | 'deliver'; title: string; text: string };

/** وسايل الدفع بالعربي، مرتّبة زي ما الإدارة ضبطتها، في جملة واحدة. */
export function methodsSentence(methods: readonly GatewayMethod[]): string {
  const labels = methods.filter((m) => m in METHOD_LABELS).map((m) => METHOD_LABELS[m]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join('، ')} أو ${labels[labels.length - 1]}`;
}

/**
 * الخطوات التلاتة.
 *
 * `payment` بييجي من `getPaymentAvailability()` — نفس المصدر اللي شاشة
 * الطلب بتقرا منه، عشان الوصف والواقع ما يفترقوش.
 */
export function serviceSteps(
  payment: { mode: 'gateway'; methods: readonly GatewayMethod[] } | { mode: 'manual' },
): ServiceStep[] {
  const pay: ServiceStep =
    payment.mode === 'gateway'
      ? {
          icon: 'pay',
          title: 'ادفع أونلاين',
          text: (() => {
            const list = methodsSentence(payment.methods);
            const head = list ? `${list} — وبيانات بطاقتك` : 'بيانات بطاقتك';
            return `${head} مابتعدّيش على موقعنا، بتتكتب على صفحة البنك.`;
          })(),
        }
      : {
          icon: 'pay',
          title: 'ادفع بالتحويل',
          text: 'إنستاباي أو فودافون كاش، وارفع صورة الإيصال وإحنا نراجعها.',
        };

  return [
    {
      icon: 'pen',
      title: 'اختار الخدمة وقول محتاج إيه',
      text: 'الخدمة ومقدّمها والمستفيد، وتفاصيل طلبك — وبتوصل لمقدّم الخدمة كأول رسالة.',
    },
    pay,
    {
      icon: 'deliver',
      title: 'تابع الشغل في «طلباتي»',
      // ⚠️ مفيش وعد بمدة هنا: مدة التسليم بتختلف من خدمة لخدمة وظاهرة
      //    على كارت كل خدمة. وعد عام هنا بيبقى وعد مانقدرش نمشي عليه.
      text: 'محادثة مباشرة مع مقدّم الخدمة، والتسليم والرسايل كلها في حسابك.',
    },
  ];
}
