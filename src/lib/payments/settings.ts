/**
 * إعدادات الدفع — مفتاح التبديل بين البوابة والتحويل اليدوي.
 *
 * ── ليه الإعداد في القاعدة مش في الكود ──────────────────────
 *
 * لو بوابة الدفع وقعت الساعة ٢ بالليل، المفروض تقفلها من اللوحة في
 * ثانية والطلبات ترجع للتحويل اليدوي فورًا. لو كان الاختيار في الكود،
 * ده كان هيحتاج تعديل ونشر وانتظار بناء — والطلبات بتضيع في الوقت ده.
 *
 * ⚠️ **المفاتيح السرية مش هنا ولا في القاعدة إطلاقًا.** أي مفتاح في
 *    القاعدة بيبقى مقروء لأي أدمن، وبيدخل في النسخ الاحتياطية وفي سجل
 *    التدقيق. مفاتيح XPay في متغيرات البيئة على Vercel:
 *      XPAY_SECRET_KEY      — مفتاح الـAPI (sk_…)
 *      XPAY_WEBHOOK_SECRET  — مفتاح توقيع الويبهوك (whsec_…)
 *    اللي هنا: مفعّل/مقفول، وطرق الدفع، ورسالة العطل.
 */

export type PaymentProvider = 'manual' | 'xpay';

/**
 * ⚠️ القيم دي **مش اختيارنا** — البوابة بترفض أي قيمة غيرها برسالة
 *    `Invalid option: expected one of "card"|"fawry"|"valu"|"apple_pay"`.
 *    كانت فيها `wallet` (محفظة إلكترونية) وهي مش موجودة عندهم أصلًا،
 *    فكل محاولة دفع كانت بتترفض.
 */
export const PAYMENT_METHODS = ['card', 'fawry', 'valu', 'apple_pay'] as const;
export type GatewayMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABELS: Record<GatewayMethod, string> = {
  card: 'فيزا وماستركارد',
  fawry: 'فوري',
  valu: 'فاليو (تقسيط)',
  apple_pay: 'Apple Pay',
};

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  manual: 'تحويل يدوي (إنستاباي / فودافون كاش)',
  xpay: 'بوابة الدفع XPay',
};

export const DEFAULT_GATEWAY_DOWN_MESSAGE =
  'الدفع بالبطاقة متوقف مؤقتًا — يمكنك الدفع بالتحويل.';

export type PaymentSettings = {
  provider: PaymentProvider;
  methods: GatewayMethod[];
  /** رسوم البوابة تتضاف على العميل؟ (قرار تامر: لأ، إحنا بنتحملها). */
  feesPassThrough: boolean;
  /** تظهر للعميل لو البوابة مقفولة والطلب محتاج دفع. */
  gatewayDownMessage: string;
};

/**
 * الافتراضي **التحويل اليدوي**. أي خلل في قراءة الإعداد بيرجّعنا للوضع
 * اللي شغّال من شهور بدل ما يحوّل العملاء لبوابة مش مظبوطة.
 */
export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: 'manual',
  methods: ['card'],
  feesPassThrough: false,
  gatewayDownMessage: '',
};

function isGatewayMethod(v: unknown): v is GatewayMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** يقرا صف `site_settings` بمفتاح `payments`، وبيرجّع الافتراضي لأي قيمة غريبة. */
export function parsePaymentSettings(raw: unknown): PaymentSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_PAYMENT_SETTINGS;
  const data = raw as Record<string, unknown>;

  const provider: PaymentProvider = data.provider === 'xpay' ? 'xpay' : 'manual';

  const methods = Array.isArray(data.methods) ? data.methods.filter(isGatewayMethod) : [];
  // ⚠️ بوابة من غير أي وسيلة دفع = صفحة دفع فاضية للعميل. البطاقة
  //    مفعّلة دايمًا كحد أدنى.
  const uniqueMethods = Array.from(new Set(methods.length > 0 ? methods : ['card' as const]));

  return {
    provider,
    methods: uniqueMethods,
    feesPassThrough: data.feesPassThrough === true,
    gatewayDownMessage:
      typeof data.gatewayDownMessage === 'string' ? data.gatewayDownMessage.trim() : '',
  };
}

export type PaymentAvailability =
  | { mode: 'gateway'; methods: GatewayMethod[] }
  | { mode: 'manual'; notice: string };

/**
 * إيه اللي يتعرض للعميل دلوقتي؟
 *
 * ⚠️ البوابة ماتتعرضش غير لو **الإعداد مفتوح والمفاتيح موجودة على
 *    الخادم**. من غير الشرط التاني، العميل كان هيدوس «ادفع» ويقابله
 *    خطأ — وده أسوأ من إننا نوريه التحويل من الأول.
 */
export function paymentAvailability(
  settings: PaymentSettings,
  gatewayConfigured: boolean,
): PaymentAvailability {
  if (settings.provider === 'xpay' && gatewayConfigured) {
    return { mode: 'gateway', methods: settings.methods };
  }
  const notice =
    settings.provider === 'xpay' && !gatewayConfigured
      ? settings.gatewayDownMessage || DEFAULT_GATEWAY_DOWN_MESSAGE
      : '';
  return { mode: 'manual', notice };
}

export type SettingsProblem = { field: 'methods' | 'gatewayDownMessage'; error: string };

/** تحقق قبل الحفظ من اللوحة. */
export function validatePaymentSettings(input: PaymentSettings): SettingsProblem | null {
  if (input.provider === 'xpay' && input.methods.length === 0) {
    return { field: 'methods', error: 'اختر وسيلة دفع واحدة على الأقل قبل تفعيل البوابة' };
  }
  if (input.gatewayDownMessage.length > 300) {
    return { field: 'gatewayDownMessage', error: 'الرسالة طويلة — 300 حرف كحد أقصى' };
  }
  return null;
}
