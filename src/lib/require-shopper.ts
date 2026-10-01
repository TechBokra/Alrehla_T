import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';

/**
 * صفحات الشراء (معالجات التخصيص + الدفع): **الزائر يسجّل دخوله الأول**،
 * وبعدها يرجع لنفس الصفحة.
 *
 * ⚠️ **الفحص كان `if (!user)` — ودي عمرها ما بتتحقق.** `getCurrentUser`
 *    مابترجّعش `null` للزائر؛ بترجّع مستخدمًا دوره `visitor`. فصفحة
 *    الدفع كانت بتفتح للزائر، والمعالجات كمان: الزائر يملا الخطوات كلها
 *    ويرفع صورة طفله، وفي **آخر زرار** الخادم يرفض — برسالة Next
 *    الإنجليزي المبهمة (قاعدة «هـ»)، ومن غير ما يعرف إن المطلوب دخول.
 */
export async function requireShopper(returnPath: string): Promise<void> {
  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    redirect(`/sign-in?next=${encodeURIComponent(returnPath)}`);
  }
}
