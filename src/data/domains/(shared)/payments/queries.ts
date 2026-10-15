import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { isXpayConfigured } from '@/lib/payments/xpay-client';
import {
  DEFAULT_PAYMENT_SETTINGS,
  parsePaymentSettings,
  paymentAvailability,
  type PaymentAvailability,
  type PaymentSettings,
} from '@/lib/payments/settings';

/**
 * إعدادات الدفع من `site_settings`.
 *
 * ⚠️ **فشل القراءة بيرجّعنا للتحويل اليدوي**، مش للبوابة. لو القاعدة
 *    مش متاحة للحظة، أسوأ حاجة تحصل إن العميل يدفع بالتحويل — أهون
 *    بكتير من إننا نحوّله لبوابة إحنا مش متأكدين إنها مفتوحة.
 */
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'payments')
    .maybeSingle();

  if (error) {
    console.error('تعذّر قراءة إعدادات الدفع — الرجوع للتحويل اليدوي', error);
    return DEFAULT_PAYMENT_SETTINGS;
  }
  return parsePaymentSettings(data?.value);
});

/** اللي يتعرض للعميل دلوقتي: بوابة ولا تحويل. */
export const getPaymentAvailability = cache(async (): Promise<PaymentAvailability> => {
  return paymentAvailability(await getPaymentSettings(), isXpayConfigured());
});
