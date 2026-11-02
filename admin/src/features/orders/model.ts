import type { OrderDetail } from "@/providers/refine/data-provider/orders-data-provider";

export type { OrderDetail };
export type OrderStatus = OrderDetail["status"];

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  awaiting_verification: "بانتظار مراجعة الدفع",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refunded: "مسترد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const paymentMethodOptions = [
  { value: "card", label: "بطاقة" },
  { value: "fawry", label: "فوري" },
  { value: "valu", label: "ڤاليو" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "instapay", label: "إنستاباي" },
  { value: "vodafone_cash", label: "فودافون كاش" },
];

export const orderStatusOptions = Object.entries(orderStatusLabels).map(
  ([value, label]) => ({ value, label }),
);

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Cairo",
      }).format(date);
}

export function orderReference(order: Pick<OrderDetail, "payment_reference" | "id">) {
  return order.payment_reference?.trim() || order.id.slice(0, 8).toUpperCase();
}

export function paymentMethodLabel(order: Pick<OrderDetail, "payment_method" | "payment_provider">) {
  if (order.payment_provider.toLowerCase().includes("xpay")) return "XPay";
  return paymentMethodOptions.find((method) => method.value === order.payment_method)?.label
    ?? order.payment_method
    ?? order.payment_provider;
}

export function orderItemsLabel(order: Pick<OrderDetail, "items">) {
  if (!order.items.length) return "لا توجد عناصر للعرض";
  return order.items.map((item) => `${item.product_name} × ${item.quantity}`).join("، ");
}

export function orderSubtotal(order: Pick<OrderDetail, "items">) {
  return order.items.reduce((total, item) => total + item.unit_price * item.quantity, 0);
}
