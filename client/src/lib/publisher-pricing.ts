/**
 * تسعير منتجات الناشرين.
 *
 * ── المعادلة ────────────────────────────────────────────────
 *
 *     سعر العميل  = نصيب الناشر × المعامل + الرسم الثابت
 *     دخل المنصة  = سعر العميل − نصيب الناشر
 *
 * ودي **نفس معادلة المدرب** (`calculateFinalSessionPrice`)، بصفّ
 * إعدادات مختلف: `publisher-default` بدل `default`. يعني المنصة
 * ليها هامش مستقل لكل نوع، والحساب واحد.
 *
 * ── وليه الملف ده موجود أصلًا ───────────────────────────────
 *
 * ⚠️ **الحساب بيتم مرة واحدة وقت الحفظ، لا وقت العرض.**
 *
 *    عمود `price` هو اللي كل شاشة في الموقع بتقراه — صفحة المنتج،
 *    والمكتبة، والسلة، وخريطة الموقع، والبيانات المنظّمة اللي جوجل
 *    بيقراها. لو الحساب اتعمل وقت العرض، كان كل موضع من دول محتاج
 *    يفتكر يحسب — ومع أول موضع ينسى، **العميل يشوف سعرًا غير اللي
 *    هيدفعه**.
 *
 *    فالناشر بيكتب نصيبه، والدالة دي بتحسب `price` وقت الحفظ،
 *    والشاشات بتفضل تقرا زي ما هي.
 */

export type PricingFormula = {
  platformMultiplier: number;
  fixedAdminFee: number;
};

/** الافتراضي لو صفّ الإعدادات مش موجود: المنصة ما بتاخدش حاجة. */
export const NEUTRAL_FORMULA: PricingFormula = {
  platformMultiplier: 1,
  fixedAdminFee: 0,
};

/**
 * سعر العميل من نصيب الناشر.
 *
 * ⚠️ **بيقرّب لأقرب جنيه**: الأسعار بتتخزّن أرقامًا صحيحة، والكسور
 *    بتطلع في الشاشة «١٢٣.٤٥٦٧ ج.م». والتقريب هنا مرة واحدة وقت
 *    الحفظ — فالرقم المخزّن هو الرقم المعروض هو الرقم المدفوع.
 */
export function customerPriceFromCost(cost: number, formula: PricingFormula): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const multiplier = Number.isFinite(formula.platformMultiplier)
    ? formula.platformMultiplier
    : 1;
  const fee = Number.isFinite(formula.fixedAdminFee) ? formula.fixedAdminFee : 0;
  return Math.round(cost * multiplier + fee);
}

/** نصيب المنصة من البيعة الواحدة — للعرض في الشاشات فقط. */
export function platformShare(cost: number, formula: PricingFormula): number {
  const price = customerPriceFromCost(cost, formula);
  return price === 0 ? 0 : price - Math.round(cost);
}
