import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';

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

  // ⚠️ **وحساب الطفل التابع كمان من الأول** — كان بيعدّي المعالج كله
  //    ويرفع صورته، ويترفض في آخر زرار (`requireNotDependent`) برسالة
  //    Next المبهمة. الشراء لولي الأمر، فبنقول ده قبل أي خطوة.
  //    وفشل الفحص نفسه بيرمي (مش بيعدّي) — نفس قاعدة `getDependentGuardian`.
  const dependent = await getDependentGuardian(user.id);
  if (dependent) {
    redirect('/enha-lak/ask-guardian');
  }
}
