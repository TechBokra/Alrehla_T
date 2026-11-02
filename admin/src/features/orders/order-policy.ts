export type OrderCommandStatus = "preparing" | "shipped" | "delivered" | "cancelled";

const allowedPreviousStatuses: Record<OrderCommandStatus, readonly string[]> = {
  preparing: ["paid"],
  shipped: ["paid", "preparing"],
  delivered: ["shipped"],
  cancelled: ["pending", "awaiting_verification", "failed", "paid", "preparing", "shipped"],
};

export function canTransitionOrder(current: string, next: OrderCommandStatus) {
  return allowedPreviousStatuses[next].includes(current);
}

export function canStartOrderPreparation(status: string) {
  return status === "paid";
}

export function canShipOrder(status: string) {
  return canTransitionOrder(status, "shipped");
}

export function canDeliverOrder(status: string) {
  return canTransitionOrder(status, "delivered");
}

export function canCancelOrder(status: string) {
  return canTransitionOrder(status, "cancelled");
}

export function canMarkElectronicOrderSent(order: {
  status: string;
  boxPlanId?: string | null;
  deliveryEmail?: string | null;
  electronicSentAt?: string | null;
  itemFormats: readonly string[];
}) {
  return !order.boxPlanId
    && ["paid", "preparing", "shipped", "delivered"].includes(order.status)
    && Boolean(order.deliveryEmail?.trim())
    && !order.electronicSentAt
    && order.itemFormats.some((format) => format === "electronic" || format === "both");
}
