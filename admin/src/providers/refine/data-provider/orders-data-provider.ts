import type { BaseRecord, DataProvider } from "@refinedev/core";
import { adminDataProvider, DataConfigurationError } from "./supabase-data-provider";
import { getSupabaseClient } from "@/providers/supabase-client";
import { adminAuthProvider } from "../auth-provider";
import { orderFulfilmentSchema, electronicDeliverySchema } from "@/lib/schema";
import { z } from "zod";
import type { Database, Json } from "@/types/supabase";
import { canTransitionOrder } from "@/features/orders/order-policy";

export const ORDERS_PROVIDER = "orders";
export const ORDER_COMMANDS = {
  startPreparation: "orders/start-preparation",
  markShipped: "orders/mark-shipped",
  markDelivered: "orders/mark-delivered",
  cancel: "orders/cancel",
  electronicSent: "orders/mark-electronic-delivery",
  retryPublisherEarnings: "orders/retry-publisher-earnings",
} as const;

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type Profile = Pick<
  Database["public"]["Tables"]["user_profiles"]["Row"],
  "id" | "full_name" | "avatar_url"
>;

export interface OrderDetail extends OrderRow {
  customer: Profile | null;
  participant: Profile | null;
  items: Array<OrderItem & { product_name: string; image_url: string | null }>;
  photoPreview: { url: string; available: boolean } | null;
  receiptPreview: { url: string; available: boolean } | null;
}

type CommandInput = {
  orderId: string;
  expectedStatus?: string;
  expectedUpdatedAt?: string;
  status?: "preparing" | "shipped" | "delivered" | "cancelled";
  trackingReference?: string;
  note?: string;
};

const transitionInputSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["preparing", "shipped", "delivered", "cancelled"]),
  expectedStatus: z.string().min(1),
  expectedUpdatedAt: z.string().min(1),
  trackingReference: z.string().optional(),
  note: z.string().optional(),
}).superRefine((value, ctx) => {
  const validation = orderFulfilmentSchema.safeParse(value);
  if (!validation.success) {
    for (const issue of validation.error.issues) ctx.addIssue(issue);
  }
});

function requiredClient() {
  const client = getSupabaseClient();
  if (!client) throw new DataConfigurationError();
  return client;
}

function isPrivateAsset(url: string | null | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").some((part) =>
      ["private", "authenticated", "secure"].includes(part.toLowerCase()),
    );
  } catch {
    return true;
  }
}

async function enrichOrders(rows: OrderRow[]): Promise<OrderDetail[]> {
  if (!rows.length) return [];
  const client = requiredClient();
  const orderIds = rows.map((row) => row.id);
  const profileIds = [...new Set(rows.flatMap((row) => [
    row.user_id,
    row.dependent_participant_id,
    row.independent_participant_id,
  ]).filter((value): value is string => Boolean(value)))];
  const [itemsResult, profilesResult] = await Promise.all([
    client.from("order_items").select("*").in("order_id", orderIds),
    profileIds.length
      ? client.from("user_profiles").select("id,full_name,avatar_url").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const items = (itemsResult.data ?? []) as OrderItem[];
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const [productsResult, addonsResult] = await Promise.all([
    productIds.length
      ? client.from("personalized_products").select("id,name,cover_image_url").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? client.from("addon_products").select("id,name,image_url").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (addonsResult.error) throw addonsResult.error;
  const names = new Map<string, { name: string; image: string | null }>();
  for (const product of productsResult.data ?? []) {
    names.set(product.id, { name: product.name, image: product.cover_image_url });
  }
  for (const addon of addonsResult.data ?? []) {
    names.set(addon.id, { name: addon.name, image: addon.image_url });
  }
  const profiles = new Map(
    ((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]),
  );
  const byOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const group = byOrder.get(item.order_id) ?? [];
    group.push(item);
    byOrder.set(item.order_id, group);
  }
  return rows.map((row) => {
    const participant = profiles.get(row.dependent_participant_id ?? row.independent_participant_id ?? "") ?? null;
    const customer = profiles.get(row.user_id) ?? null;
    const photo = participant?.avatar_url ?? customer?.avatar_url ?? null;
    return {
      ...row,
      customer,
      participant,
      photoPreview: photo ? { url: photo, available: !isPrivateAsset(photo) } : null,
      receiptPreview: row.payment_receipt_url
        ? { url: row.payment_receipt_url, available: !isPrivateAsset(row.payment_receipt_url) }
        : null,
      items: (byOrder.get(row.id) ?? []).map((item) => {
        const product = names.get(item.product_id);
        return {
          ...item,
          product_name: product?.name ?? "منتج غير متاح",
          image_url: product?.image ?? null,
        };
      }),
    };
  });
}

async function requireOrdersActor() {
  const client = requiredClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("سجّل الدخول بحساب إداري نشط.");
  const actor = await adminAuthProvider.getAuthorization(true);
  if (!actor || actor.id !== user.id || (actor.role !== "super_admin" && !actor.permissions.includes("canManageOrders"))) {
    throw new Error("لا تملك صلاحية إدارة الطلبات.");
  }
  return { client, actor };
}

/** Match the existing notification-event setting; a settings read failure is fail-open. */
async function isOrderStatusNotificationDisabled(
  client: ReturnType<typeof requiredClient>,
) {
  try {
    const { data, error } = await client
      .from("site_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();
    if (error) return false;
    const disabled = (data?.value as { disabled?: unknown } | null)?.disabled;
    return Array.isArray(disabled) && disabled.includes("order_status");
  } catch {
    return false;
  }
}

async function verifyExpectedOrder(input: CommandInput) {
  if (!input.orderId || !input.expectedStatus || !input.expectedUpdatedAt) {
    throw new Error("حالة الطلب غير مكتملة. حدّث التفاصيل ثم حاول مرة أخرى.");
  }
  const { client } = await requireOrdersActor();
  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("id", input.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("الطلب غير موجود أو غير متاح.");
  if (data.status !== input.expectedStatus || data.updated_at !== input.expectedUpdatedAt) {
    throw new Error("تغيّرت حالة الطلب. حدّث التفاصيل ثم أعد المحاولة.");
  }
  if (data.box_plan_id) throw new Error("طلبات الصندوق لها مسار متابعة منفصل.");
  return { client, order: data };
}

async function postTransitionEffects({
  order,
  status,
  trackingReference,
  note,
}: {
  order: OrderRow;
  status: string;
  trackingReference?: string | null;
  note?: string | null;
}) {
  const client = requiredClient();
  const warnings: string[] = [];
  const labels: Record<string, string> = {
    preparing: "قيد التجهيز",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };
  try {
    const { error: auditError } = await client.from("audit_logs").insert({
      actor_profile_id: (await client.auth.getUser()).data.user?.id ?? null,
      action: `order_marked_${status}`,
      entity_type: "Order",
      entity_id: order.id,
      metadata: {
        status,
        trackingReference: trackingReference || null,
        note: note || null,
      } as Json,
    });
    if (auditError) warnings.push("تم تحديث حالة الطلب، لكن تعذّر تسجيل العملية في سجل التدقيق.");
  } catch {
    warnings.push("تم تحديث حالة الطلب، لكن تعذّر تسجيل العملية في سجل التدقيق.");
  }

  const notificationsDisabled = await isOrderStatusNotificationDisabled(client);
  if (!notificationsDisabled) {
    try {
      const { error: notifyError } = await client.rpc("notify_user", {
        p_recipient: order.user_id,
        p_title: `طلبك: ${labels[status] ?? status}`,
        p_message: status === "shipped" && trackingReference
          ? `رقم الشحنة: ${trackingReference}`
          : note ?? undefined,
        p_link: "/account/orders/enha-lak",
      });
      if (notifyError) warnings.push("تم تحديث حالة الطلب، لكن تعذّر إرسال إشعار للعميل.");
    } catch {
      warnings.push("تم تحديث حالة الطلب، لكن تعذّر إرسال إشعار للعميل.");
    }
  }

  if (status === "delivered") {
    let payout: unknown;
    let payoutFailed = false;
    try {
      const result = await client.rpc("record_order_publisher_earnings", {
        p_order_id: order.id,
      });
      payout = result.data;
      payoutFailed = Boolean(result.error);
    } catch {
      payoutFailed = true;
    }
    if (payoutFailed) {
      warnings.push("تم تسجيل التسليم، لكن تعذّر تسجيل مستحقات الناشرين. استخدم إعادة المحاولة من تفاصيل الطلب.");
    } else if (payout && typeof payout === "object" && "missing_cost" in payout && Number(payout.missing_cost) > 0) {
      warnings.push("تم التسليم، لكن بعض مستحقات الناشرين لم تُسجّل بسبب نقص تكلفة المنتج.");
      if (!notificationsDisabled) {
        try {
          const { error: adminNotifyError } = await client.rpc("notify_admins", {
            p_title: "مستحق ناشر ما اتسجّلش",
            p_message: `الطلب ${order.id}: يوجد منتج ناشر بلا تكلفة ناشر مسجلة.`,
            p_link: `/dashboard/admin/orders/${order.id}`,
          });
          if (adminNotifyError) warnings.push("تعذّر إرسال تنبيه الإدارة عن تكلفة الناشر.");
        } catch {
          warnings.push("تعذّر إرسال تنبيه الإدارة عن تكلفة الناشر.");
        }
      }
    }
  }

  return { warnings };
}

async function transition(inputValue: unknown, expectedStatus: string) {
  const input = transitionInputSchema.parse(inputValue) as CommandInput;
  if (!input.expectedStatus || !input.expectedUpdatedAt) {
    throw new Error("حالة الطلب غير مكتملة. حدّث التفاصيل ثم حاول مرة أخرى.");
  }
  const status = input.status!;
  const { client, order } = await verifyExpectedOrder(input);
  if (order.status !== expectedStatus || order.status !== input.expectedStatus || order.updated_at !== input.expectedUpdatedAt) {
    throw new Error("تغيّرت حالة الطلب. حدّث التفاصيل ثم أعد المحاولة.");
  }
  if (!canTransitionOrder(order.status, status)) {
    throw new Error("انتقال الحالة غير مسموح من الحالة الحالية.");
  }
  const now = new Date().toISOString();
  const values: Database["public"]["Tables"]["orders"]["Update"] = {
    status,
    updated_at: now,
  };
  const tracking = input.trackingReference?.trim();
  const note = input.note?.trim();
  if (status === "shipped") {
    values.shipped_at = now;
    if (input.trackingReference !== undefined) values.tracking_reference = tracking || null;
  }
  if (status === "delivered") values.delivered_at = now;
  if (note) values.admin_notes = note;
  const { data, error } = await client
    .from("orders")
    .update(values)
    .eq("id", order.id)
    .eq("status", order.status)
    .eq("updated_at", order.updated_at)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("تغيّرت حالة الطلب أثناء الحفظ. حدّث التفاصيل ثم أعد المحاولة.");
  const effects = await postTransitionEffects({ order: data, status, trackingReference: tracking, note });
  return { id: data.id, status: data.status, warnings: effects.warnings } as unknown as BaseRecord;
}

async function markElectronicDelivery(payload: unknown) {
  const parsed = electronicDeliverySchema.parse(payload) as { orderId: string };
  const input = payload as CommandInput;
  const { client, order } = await verifyExpectedOrder(input);
  const current = await enrichOrders([order]);
  const isElectronic = current[0]?.items.some((item) => ["electronic", "both"].includes(item.format));
  if (!isElectronic || !order.delivery_email?.trim() || order.electronic_sent_at) {
    throw new Error("لازم يكون الطلب مدفوعًا وفيه نسخة إلكترونية غير مرسلة وبريد استلام.");
  }
  if (!["paid", "preparing", "shipped", "delivered"].includes(order.status)) {
    throw new Error("لا يمكن تسجيل إرسال النسخة الإلكترونية من الحالة الحالية.");
  }
  const sentAt = new Date().toISOString();
  const { data, error } = await client.from("orders")
    .update({ electronic_sent_at: sentAt, updated_at: sentAt })
    .eq("id", parsed.orderId)
    .eq("status", order.status)
    .eq("updated_at", order.updated_at)
    .is("electronic_sent_at", null)
    .select("id,user_id,delivery_email")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("تغيّرت حالة الطلب أو سُجّل الإرسال بالفعل. حدّث التفاصيل.");
  const warnings: string[] = [];
  try {
    const { error: auditError } = await client.from("audit_logs").insert({
      actor_profile_id: (await client.auth.getUser()).data.user?.id ?? null,
      action: "order_electronic_sent",
      entity_type: "Order",
      entity_id: data.id,
    });
    if (auditError) warnings.push("تم تسجيل الإرسال، لكن تعذّر تسجيل العملية في سجل التدقيق.");
  } catch {
    warnings.push("تم تسجيل الإرسال، لكن تعذّر تسجيل العملية في سجل التدقيق.");
  }
  if (!(await isOrderStatusNotificationDisabled(client))) {
    try {
      const { error: notifyError } = await client.rpc("notify_user", {
        p_recipient: data.user_id,
        p_title: "النسخة الإلكترونية اتبعتت",
        p_message: `على ${data.delivery_email} — لو مالقيتهاش بص في الرسائل غير المرغوب فيها.`,
        p_link: "/account/orders/enha-lak",
      });
      if (notifyError) warnings.push("تم تسجيل الإرسال، لكن تعذّر إرسال إشعار للعميل.");
    } catch {
      warnings.push("تم تسجيل الإرسال، لكن تعذّر إرسال إشعار للعميل.");
    }
  }
  return { id: data.id, warnings } as unknown as BaseRecord;
}

async function retryPublisherEarnings(payload: unknown) {
  const input = payload as CommandInput;
  const { client, order } = await verifyExpectedOrder(input);
  if (order.status !== "delivered") throw new Error("تسجيل مستحقات الناشرين متاح بعد التسليم فقط.");
  const { data, error } = await client.rpc("record_order_publisher_earnings", {
    p_order_id: order.id,
  });
  if (error) throw error;
  const warnings = data && typeof data === "object" && "missing_cost" in data && Number(data.missing_cost) > 0
    ? ["توجد منتجات ناشرين بلا تكلفة ناشر مسجلة."]
    : [];
  if (warnings.length && !(await isOrderStatusNotificationDisabled(client))) {
    try {
      const { error: notifyError } = await client.rpc("notify_admins", {
        p_title: "مستحق ناشر ما اتسجّلش",
        p_message: `الطلب ${order.id}: يوجد منتج ناشر بلا تكلفة ناشر مسجلة.`,
      p_link: `/dashboard/admin/orders/${order.id}`,
      });
      if (notifyError) warnings.push("تعذّر إرسال تنبيه الإدارة عن تكلفة الناشر.");
    } catch {
      warnings.push("تعذّر إرسال تنبيه الإدارة عن تكلفة الناشر.");
    }
  }
  return { id: order.id, payout: data, warnings } as unknown as BaseRecord;
}

async function runCommand(url: string, payload: unknown) {
  switch (url) {
    case ORDER_COMMANDS.startPreparation:
      return transition(payload, "paid");
    case ORDER_COMMANDS.markShipped: {
      const input = payload as CommandInput;
      if (!canTransitionOrder(input.expectedStatus ?? "", "shipped")) throw new Error("لا يمكن شحن الطلب من حالته الحالية.");
      return transition(payload, input.expectedStatus!);
    }
    case ORDER_COMMANDS.markDelivered:
      return transition(payload, "shipped");
    case ORDER_COMMANDS.cancel: {
      const input = payload as CommandInput;
      if (!canTransitionOrder(input.expectedStatus ?? "", "cancelled")) throw new Error("لا يمكن إلغاء الطلب من حالته الحالية.");
      return transition(payload, input.expectedStatus!);
    }
    case ORDER_COMMANDS.electronicSent:
      return markElectronicDelivery(payload);
    case ORDER_COMMANDS.retryPublisherEarnings:
      return retryPublisherEarnings(payload);
    default:
      throw new Error("أمر الطلبات غير مدعوم.");
  }
}

export const ordersDataProvider: Required<DataProvider> = {
  ...adminDataProvider,
  getList: (async (params) => {
    const result = await adminDataProvider.getList(params);
    const detail = await enrichOrders(result.data as unknown as OrderRow[]);
    return { ...result, data: detail as unknown as BaseRecord[] };
  }) as Required<DataProvider>["getList"],
  getOne: (async (params) => {
    const result = await adminDataProvider.getOne(params);
    const [detail] = await enrichOrders([result.data as unknown as OrderRow]);
    return { ...result, data: detail as unknown as BaseRecord };
  }) as Required<DataProvider>["getOne"],
  create: async () => { throw new Error("إنشاء الطلبات من لوحة الإدارة غير متاح."); },
  createMany: async () => { throw new Error("إنشاء الطلبات من لوحة الإدارة غير متاح."); },
  update: async () => { throw new Error("تغيير الطلبات يتم من الأوامر المخصصة فقط."); },
  updateMany: async () => { throw new Error("تغيير الطلبات يتم من الأوامر المخصصة فقط."); },
  deleteOne: async () => { throw new Error("حذف الطلبات من لوحة الإدارة غير متاح."); },
  deleteMany: async () => { throw new Error("حذف الطلبات من لوحة الإدارة غير متاح."); },
  custom: (async ({ url, method, payload }) => {
    if (method?.toLowerCase() !== "post") throw new Error("طريقة أمر الطلبات غير مدعومة.");
    const result = await runCommand(url, payload);
    return { data: result };
  }) as Required<DataProvider>["custom"],
};
