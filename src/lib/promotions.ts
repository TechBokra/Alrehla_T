/**
 * عروض الأسعار المؤقتة (خصم بنسبة أو سعر عرض بتاريخ بداية ونهاية).
 *
 * ⚠️ **الحساب الحقيقي في القاعدة** — الدالة `effective_price` جوّه
 *    `create_customer_order` و`create_box_subscription_order`. اللي هنا
 *    للعرض بس (خط على السعر القديم، شارة، تاريخ الانتهاء) وبنفس القواعد
 *    بالحرف، عشان الرقم اللي العميل بيشوفه هو اللي بيدفعه:
 *      • أفضل عرض ساري = الأقل سعرًا
 *      • النسبة: round(الأصل × (١٠٠ − النسبة) ÷ ١٠٠)
 *      • سعر العرض: الأقل من (سعر العرض، الأصل) — العرض مابيرفعش السعر أبدًا
 *      • الساري: مفعّل و `بداية ≤ الآن < نهاية`
 *    أي تعديل في القواعد لازم يتعمل في الاتنين.
 */

export const PROMOTION_TARGETS = ['product_printed', 'product_electronic', 'addon', 'box_plan'] as const;
export type PromotionTarget = (typeof PROMOTION_TARGETS)[number];

export const PROMOTION_TARGET_LABELS: Record<PromotionTarget, string> = {
  product_printed: 'قصة — النسخة المطبوعة',
  product_electronic: 'قصة — النسخة الإلكترونية',
  addon: 'إضافة',
  box_plan: 'خطة صندوق الرحلة',
};

export type PromotionKind = 'percent' | 'sale_price';

export type Promotion = {
  id: string;
  targetType: PromotionTarget;
  targetId: string;
  kind: PromotionKind;
  value: number;
  label: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type AppliedPromotion = {
  /** السعر بعد العرض. */
  price: number;
  /** السعر الأصلي. */
  listPrice: number;
  endsAt: string;
  label: string | null;
};

export const MAX_PROMOTION_LABEL = 60;

export function isPromotionTarget(v: unknown): v is PromotionTarget {
  return typeof v === 'string' && (PROMOTION_TARGETS as readonly string[]).includes(v);
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/** ساري في اللحظة دي؟ (مفعّل وبداية ≤ الآن < نهاية) */
export function isLive(p: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>, now: Date): boolean {
  const t = now.getTime();
  return p.isActive && t >= ms(p.startsAt) && t < ms(p.endsAt);
}

export type PromotionState = 'live' | 'upcoming' | 'ended' | 'paused';

/** حالة العرض للإدارة. الموقوف يغلب (حتى لو موعده فات). */
export function promotionState(
  p: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>,
  now: Date,
): PromotionState {
  if (!p.isActive) return 'paused';
  const t = now.getTime();
  if (t < ms(p.startsAt)) return 'upcoming';
  if (t >= ms(p.endsAt)) return 'ended';
  return 'live';
}

export const PROMOTION_STATE_LABELS: Record<PromotionState, string> = {
  live: 'ساري الآن',
  upcoming: 'قادم',
  ended: 'منتهي',
  paused: 'موقوف',
};

/** السعر بعد عرض واحد على `base` (بدون فحص التاريخ). */
export function discountedPrice(p: Pick<Promotion, 'kind' | 'value'>, base: number): number {
  if (p.kind === 'percent') {
    // التقريب لست خانات قبل round عشان خطأ الفاصلة العائمة ما يقلبش نصف جنيه.
    return Math.round(Number(((base * (100 - p.value)) / 100).toFixed(6)));
  }
  return Math.min(p.value, base);
}

/**
 * أفضل عرض ساري على هدف معيّن، أو `null` لو مفيش عرض بيخفّض السعر فعلًا.
 * عند التعادل في السعر بنختار اللي بينتهي أبكر (عشان التاريخ المعروض هو الأقرب).
 */
export function bestPromotion(
  promotions: readonly Promotion[],
  targetType: PromotionTarget,
  targetId: string,
  base: number,
  now: Date,
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null;
  for (const p of promotions) {
    if (p.targetType !== targetType || p.targetId !== targetId || !isLive(p, now)) continue;
    const price = discountedPrice(p, base);
    if (!(price < base)) continue;
    if (!best || price < best.price || (price === best.price && ms(p.endsAt) < ms(best.endsAt))) {
      best = { price, listPrice: base, endsAt: p.endsAt, label: p.label };
    }
  }
  return best;
}

/** السعر الفعلي بعد العروض السارية. */
export function effectivePrice(
  promotions: readonly Promotion[],
  targetType: PromotionTarget,
  targetId: string,
  base: number,
  now: Date,
): number {
  return bestPromotion(promotions, targetType, targetId, base, now)?.price ?? base;
}

/** نسبة التوفير للشارة («خصم ٢٥٪»). */
export function savingsPercent(listPrice: number, price: number): number {
  if (!(listPrice > 0) || !(price < listPrice)) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

// ── تطبيق العروض على كائنات العرض ─────────────────────────────

export type SaleFields = {
  /** السعر الأصلي قبل العرض — موجود فقط لو فيه عرض ساري. */
  listPrice?: number;
  /** نهاية العرض (ISO). */
  saleEndsAt?: string;
  saleLabel?: string;
};

export type ProductPricing = {
  id: string;
  price: number;
  electronicPrice?: number;
};

/**
 * `price`/`electronicPrice` بعد العرض + حقول العرض. الكائن الأصلي ما بيتغيّرش.
 * ⚠️ للصفحات العامة بس — الإدارة والناشر لازم يشوفوا السعر الأصلي.
 */
export function applyProductPromotions<T extends ProductPricing>(
  product: T,
  promotions: readonly Promotion[],
  now: Date,
): T & SaleFields & { electronicListPrice?: number; electronicSaleEndsAt?: string } {
  const printed = bestPromotion(promotions, 'product_printed', product.id, product.price, now);
  const electronic =
    product.electronicPrice && product.electronicPrice > 0
      ? bestPromotion(promotions, 'product_electronic', product.id, product.electronicPrice, now)
      : null;
  if (!printed && !electronic) return product;
  return {
    ...product,
    ...(printed
      ? {
          price: printed.price,
          listPrice: printed.listPrice,
          saleEndsAt: printed.endsAt,
          ...(printed.label ? { saleLabel: printed.label } : {}),
        }
      : {}),
    ...(electronic
      ? {
          electronicPrice: electronic.price,
          electronicListPrice: electronic.listPrice,
          electronicSaleEndsAt: electronic.endsAt,
        }
      : {}),
  };
}

export function applyAddonPromotions<T extends { id: string; price: number }>(
  addon: T,
  promotions: readonly Promotion[],
  now: Date,
): T & SaleFields {
  const sale = bestPromotion(promotions, 'addon', addon.id, addon.price, now);
  if (!sale) return addon;
  return {
    ...addon,
    price: sale.price,
    listPrice: sale.listPrice,
    saleEndsAt: sale.endsAt,
    ...(sale.label ? { saleLabel: sale.label } : {}),
  };
}

export function applyBoxPlanPromotions<
  T extends { id: string; priceTotal: number; priceMonthly: number; durationMonths: number },
>(plan: T, promotions: readonly Promotion[], now: Date): T & SaleFields & { listPriceMonthly?: number } {
  const sale = bestPromotion(promotions, 'box_plan', plan.id, plan.priceTotal, now);
  if (!sale) return plan;
  return {
    ...plan,
    priceTotal: sale.price,
    priceMonthly: Math.round(sale.price / Math.max(1, plan.durationMonths)),
    listPrice: sale.listPrice,
    listPriceMonthly: plan.priceMonthly,
    saleEndsAt: sale.endsAt,
    ...(sale.label ? { saleLabel: sale.label } : {}),
  };
}

// ── التحقق من مدخلات الإدارة ──────────────────────────────────

export type PromotionInput = {
  targetType: string;
  targetId: string;
  kind: string;
  value: number;
  label?: string | null;
  startsAt: string;
  endsAt: string;
};

export type ValidPromotion = {
  targetType: PromotionTarget;
  targetId: string;
  kind: PromotionKind;
  value: number;
  label: string | null;
  startsAt: string;
  endsAt: string;
};

/**
 * نفس قيود الجدول + قواعد إضافية للتطبيق (أرقام صحيحة، السعر أقل من الأصل).
 * `basePrice` = السعر الأصلي للهدف من القاعدة (مش من المتصفح).
 */
export function validatePromotion(
  input: PromotionInput,
  basePrice: number,
): { ok: true; value: ValidPromotion } | { ok: false; error: string } {
  if (!isPromotionTarget(input.targetType)) return { ok: false, error: 'نوع العرض غير معروف' };
  const targetId = (input.targetId ?? '').trim();
  if (!targetId) return { ok: false, error: 'اختار ما ينطبق عليه العرض' };
  if (input.kind !== 'percent' && input.kind !== 'sale_price') {
    return { ok: false, error: 'نوع الخصم غير معروف' };
  }
  const v = input.value;
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
    return { ok: false, error: 'القيمة لازم تكون رقمًا صحيحًا أكبر من صفر' };
  }
  if (input.kind === 'percent' && v >= 100) {
    return { ok: false, error: 'نسبة الخصم لازم تكون أقل من ١٠٠٪' };
  }
  if (input.kind === 'sale_price' && !(v < basePrice)) {
    return { ok: false, error: `سعر العرض لازم يكون أقل من السعر الأصلي (${basePrice} ج.م)` };
  }
  const label = (input.label ?? '').trim();
  if (label.length > MAX_PROMOTION_LABEL) {
    return { ok: false, error: `عنوان العرض أطول من ${MAX_PROMOTION_LABEL} حرفًا` };
  }
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'تاريخ البداية أو النهاية غير صحيح' };
  }
  if (!(end.getTime() > start.getTime())) {
    return { ok: false, error: 'تاريخ النهاية لازم يكون بعد البداية' };
  }
  return {
    ok: true,
    value: {
      targetType: input.targetType,
      targetId,
      kind: input.kind,
      value: v,
      label: label || null,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    },
  };
}

// ── التوقيت: الإدارة بتكتب بتوقيت القاهرة ─────────────────────

const CAIRO = 'Africa/Cairo';

function cairoOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** «2026-11-01T09:00» بتوقيت القاهرة ← ISO بالـUTC، أو `null` لو الصيغة غلط. */
export function cairoLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((local ?? '').trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(guess)) return null;
  // تصحيحان لأن فرق التوقيت نفسه بيتغيّر عند حدود التوقيت الصيفي.
  let utc = guess - cairoOffsetMs(guess);
  utc = guess - cairoOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** ISO ← «YYYY-MM-DDTHH:mm» بتوقيت القاهرة لخانة datetime-local. */
export function isoToCairoLocal(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const shifted = new Date(t + cairoOffsetMs(t));
  return shifted.toISOString().slice(0, 16);
}
