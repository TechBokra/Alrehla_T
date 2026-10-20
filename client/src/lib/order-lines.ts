/**
 * طلب منتجات «إنها لك» — **فيه إيه بالظبط**، بنفس الشكل للإدارة وللعميل.
 *
 * ⚠️ قبل كده كل شاشة كانت بتعرض حتة: القايمة اسم المنتج بس، وصفحة
 *    العميل الاسم والكمية، والإضافات كانت مستخبية جوه كارت التخصيص.
 *    (طلب تامر: «يبقى ظاهر بوضوح للإدارة وللمستخدم المنتجات اللي طلبها
 *    مع الإضافات وكل التفاصيل».)
 *
 * الأسعار من الطلب نفسه (`unit_price` بيشمل الإضافات، ومتثبّت وقت
 * الشراء) — مش من المنتج دلوقتي، عشان تغيير السعر بعدين مايغيّرش طلب قديم.
 */
import type { Order, OrderItem } from '@/types';
import { describeCustomization, type CustomizationAddon } from '@/lib/order-customization';
import { FORMAT_LABELS, type ItemFormat } from '@/lib/item-format';

/** نوع الطلب — للفلترة في لوحة الإدارة. */
export type OrderKind = 'custom' | 'library' | 'box' | 'mixed';

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  custom: '«أنت البطل هنا»',
  library: 'المكتبة (تخصيص غلاف)',
  box: 'صندوق الرحلة',
  mixed: 'طلب مختلط',
};

export type OrderLine = {
  name: string;
  /** `custom` · `library` · … — أو `unknown` لمنتج اتمسح. */
  category: string;
  quantity: number;
  /** سعر الوحدة **شامل الإضافات**. */
  unitPrice: number;
  /** سعر المنتج نفسه من غير الإضافات. */
  basePrice: number;
  format: ItemFormat;
  /** «نسخة مطبوعة» … — فاضي للمطبوع (الافتراضي). */
  formatLabel: string;
  childName?: string;
  addons: CustomizationAddon[];
};

function childOf(item: OrderItem): string | undefined {
  const v = (item.customizationData as { childName?: unknown } | undefined)?.childName;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function orderLines(
  order: Pick<Order, 'items'>,
  names: Record<string, string>,
  categories: Record<string, string> = {},
): OrderLine[] {
  return order.items.map((item) => {
    const addons = describeCustomization(item.customizationData).addons;
    const addonsTotal = addons.reduce((s, a) => s + (a.price ?? 0), 0);
    const unit = Number(item.unitPrice) || 0;
    const format: ItemFormat = item.format ?? 'printed';
    return {
      name: names[item.productId] ?? 'منتج لم يعد معروضًا',
      category: categories[item.productId] ?? 'unknown',
      quantity: item.quantity || 1,
      unitPrice: unit,
      basePrice: Math.max(0, unit - addonsTotal),
      format,
      formatLabel: format === 'printed' ? '' : FORMAT_LABELS[format],
      childName: childOf(item),
      addons,
    };
  });
}

/** اسم خطة الصندوق من تفاصيل الطلب. */
export function boxPlanName(order: Pick<Order, 'boxDetails'>): string | undefined {
  const name = (order.boxDetails as { plan?: { name?: unknown } } | undefined)?.plan?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

/** سعر الخطة وقت الشراء (قبل الشحن والخصم). */
export function boxPlanPrice(order: Pick<Order, 'boxDetails'>): number | undefined {
  const price = (order.boxDetails as { plan?: { price?: unknown } } | undefined)?.plan?.price;
  return typeof price === 'number' && Number.isFinite(price) ? price : undefined;
}

export function orderKind(
  order: Pick<Order, 'items' | 'boxPlanId'>,
  categories: Record<string, string>,
): OrderKind {
  if (order.boxPlanId) return 'box';
  const kinds = new Set(
    order.items.map((i) => (categories[i.productId] === 'library' ? 'library' : 'custom')),
  );
  if (kinds.size === 1) return [...kinds][0] as OrderKind;
  return kinds.size === 0 ? 'custom' : 'mixed';
}

/** المنتجات قبل الخصم والشحن. */
export function orderSubtotal(order: Pick<Order, 'items' | 'boxDetails' | 'boxPlanId'>): number {
  if (order.boxPlanId) return boxPlanPrice(order) ?? 0;
  return order.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0);
}

/** نص واحد للبحث: المنتجات والإضافات واسم الطفل. */
export function orderSearchText(lines: OrderLine[], extra: (string | undefined)[] = []): string {
  return [
    ...lines.flatMap((l) => [l.name, l.childName, ...l.addons.map((a) => a.name)]),
    ...extra,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
