import { ORDER_COMMANDS } from "@/providers/refine/data-provider/orders-data-provider";
import type { ResourceCommandDefinition, ResourceCommandMap } from "@/hooks/resources/page/use-resource-commands";
import type { OrderDetail } from "./model";
import {
  canCancelOrder,
  canDeliverOrder,
  canMarkElectronicOrderSent,
  canShipOrder,
  canStartOrderPreparation,
} from "./order-policy";

const canManageOrder = (record: OrderDetail) => !record.box_plan_id;
const invalidateOrder = (id?: string): NonNullable<ResourceCommandDefinition<OrderDetail>["invalidates"]> => [
  { resource: "orders", dataProviderName: "orders", invalidates: ["list", "detail"], ...(id ? { id } : {}) },
];

export const orderCommands = {
  startPreparation: {
    label: "بدء التجهيز",
    description: "سيتم نقل الطلب المدفوع إلى حالة قيد التجهيز.",
    authorizationAction: "start_preparation",
    command: ORDER_COMMANDS.startPreparation,
    isEligible: (order) => canManageOrder(order) && canStartOrderPreparation(order.status),
    toValues: (order) => ({ orderId: order.id, status: "preparing", expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: invalidateOrder(),
  },
  markShipped: {
    label: "تسجيل الشحن",
    description: "سيتم تحديث الحالة إلى تم الشحن. رقم التتبع اختياري.",
    authorizationAction: "mark_shipped",
    command: ORDER_COMMANDS.markShipped,
    fields: [{ name: "trackingReference", label: "رقم التتبع", maxLength: 120 }],
    validate: (input) => input.trackingReference?.length && input.trackingReference.length > 120
      ? "رقم التتبع يجب ألا يتجاوز 120 حرفًا."
      : undefined,
    isEligible: (order) => canManageOrder(order) && canShipOrder(order.status),
    toValues: (order, input) => ({ orderId: order.id, status: "shipped", trackingReference: input.trackingReference, expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: invalidateOrder(),
  },
  markDelivered: {
    label: "تسجيل التسليم",
    description: "تأكيد تسليم الطلب للعميل وتسجيل مستحقات الناشرين إن وجدت.",
    authorizationAction: "mark_delivered",
    command: ORDER_COMMANDS.markDelivered,
    isEligible: (order) => canManageOrder(order) && canDeliverOrder(order.status),
    toValues: (order) => ({ orderId: order.id, status: "delivered", expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: invalidateOrder(),
  },
  cancel: {
    label: "إلغاء الطلب",
    description: "اكتب سبب الإلغاء. سيُسجّل السبب مع الطلب.",
    authorizationAction: "cancel",
    command: ORDER_COMMANDS.cancel,
    fields: [{ name: "note", label: "سبب الإلغاء", kind: "textarea", required: true, minLength: 3, maxLength: 1000 }],
    validate: (input) => (input.note?.trim().length ?? 0) < 3
      ? "اكتب سبب الإلغاء (3 أحرف على الأقل)."
      : input.note!.length > 1000 ? "سبب الإلغاء يجب ألا يتجاوز 1000 حرف." : undefined,
    isEligible: (order) => canManageOrder(order) && canCancelOrder(order.status),
    toValues: (order, input) => ({ orderId: order.id, status: "cancelled", note: input.note?.trim(), expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: invalidateOrder(),
  },
  electronicSent: {
    label: "تسجيل إرسال النسخة الإلكترونية",
    description: "يسجّل إرسال النسخة الإلكترونية للعميل. لا يرسل الملف تلقائيًا.",
    authorizationAction: "mark_electronic_delivery",
    command: ORDER_COMMANDS.electronicSent,
    isEligible: (order) => canMarkElectronicOrderSent({
      status: order.status,
      boxPlanId: order.box_plan_id,
      deliveryEmail: order.delivery_email,
      electronicSentAt: order.electronic_sent_at,
      itemFormats: order.items.map((item) => item.format),
    }),
    toValues: (order) => ({ orderId: order.id, expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: invalidateOrder(),
  },
  retryPublisherEarnings: {
    label: "إعادة محاولة تسجيل مستحقات الناشرين",
    description: "يعيد تشغيل العملية الموجودة والآمنة للتكرار بعد اكتمال التسليم.",
    authorizationAction: "retry_publisher_earnings",
    command: ORDER_COMMANDS.retryPublisherEarnings,
    isEligible: (order) => canManageOrder(order) && order.status === "delivered",
    toValues: (order) => ({ orderId: order.id, expectedStatus: order.status, expectedUpdatedAt: order.updated_at }),
    invalidates: [
      ...invalidateOrder(),
      { resource: "publisher_payouts", invalidates: ["list", "many"] },
    ],
  },
} satisfies ResourceCommandMap<OrderDetail>;
