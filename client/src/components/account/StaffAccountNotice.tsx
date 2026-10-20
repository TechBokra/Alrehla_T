import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { staffPurchaseBlock } from '@/lib/buying-roles';
import type { UserRole } from '@/types';

/**
 * «حسابك حساب شغل» — الشاشة اللي بتظهر مكان نموذج الطلب.
 *
 * ── ليه مكان النموذج مش فوقه ────────────────────────────────
 *
 * ⚠️ الدرس المكتوب في `require-shopper.ts` بالحرف: الحارس اللي
 *    بيرفض في **آخر زرار** بيخلّي الواحد يملا الخطوات كلها ويرفع
 *    صورة ويختار وسيلة دفع، وبعدين يترفض. والرفض ده بيوصل كرسالة
 *    حمرا في شريط — مش كسبب مفهوم.
 *
 *    فالمدرب اللي داخل يطلب قصة لبنته لازم يعرف من أول ثانية إن
 *    المشكلة في نوع الحساب، والحل إنه يعمل حساب تاني — مش إنه
 *    يحاول تاني بنفس الحساب.
 *
 * ⚠️ **ودي مش الحارس.** الحارس في `requireBuyer` ومحفّز
 *    `block_suspended_purchase` في القاعدة. دي الشرح.
 */
export function StaffAccountNotice({
  role,
  what,
}: {
  role: UserRole | null | undefined;
  /** «الطلب» / «الحجز» / «الاشتراك» — بيدخل في العنوان. */
  what: string;
}) {
  const block = staffPurchaseBlock(role);
  if (!block) return null;

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <Briefcase className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-black text-amber-900">
          {what} بيتم من حساب عميل، وحسابك حساب {block.label}
        </h2>
      </div>

      <p className="mb-4 text-sm font-medium leading-relaxed text-amber-900">{block.message}</p>

      <div className="mb-5 rounded-xl bg-white/70 p-4 text-sm font-medium leading-relaxed text-amber-900">
        <p className="mb-1 font-black">ليه؟</p>
        <p>
          حساب الشغل مربوط بأرباحك وسحوباتك وجلساتك. لو طلب منه، بيبقى في نفس
          الطلب طرفين: اللي بيدفع واللي بياخد — وده بيبهدل كشف حسابك وكشف
          المنصة. الحساب التاني بيفصل الاتنين، وشغلك مابيتأثرش.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-amber-700 px-5 font-bold text-white transition-colors hover:bg-amber-800"
        >
          اعمل حساب عميل جديد
        </Link>
        <Link
          href="/support"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-amber-300 bg-white px-5 font-bold text-amber-900 transition-colors hover:bg-amber-100"
        >
          محتاج مساعدة؟ كلّمنا
        </Link>
      </div>
    </div>
  );
}
