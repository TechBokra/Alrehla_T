import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  UpdateParams,
} from "@refinedev/core";
import { boxPlanSchema } from "@/lib/schema";
import { getSupabaseClient } from "@/providers/supabase-client";
import { BOX_PLANS_RESOURCE } from "@/features/subscriptions/box-plans/model";
import { assertResourceAccess } from "../access-control-provider";
import { adminDataProvider as base } from "./supabase-data-provider";

const addonOptionsResource = "box_plan_addons";

async function writeAudit(action: string, entityId: string) {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { error } = await client.from("audit_logs").insert({
      actor_profile_id: user.id,
      action,
      entity_type: "BoxSubscriptionPlan",
      entity_id: entityId,
    });
    if (error) console.error("Error writing box plan audit log", error);
  } catch (error) {
    console.error("Error writing box plan audit log", error);
  }
}

function assertPlanResource(resource: string) {
  if (resource !== BOX_PLANS_RESOURCE)
    throw new Error("هذا الإجراء غير متاح لخطط صندوق الرحلة.");
}

function toDatabaseRow(input: unknown) {
  const value = boxPlanSchema.parse(input);
  return {
    name: value.name,
    price_total: value.priceTotal,
    price_monthly: value.priceMonthly,
    duration_months: value.durationMonths,
    savings_note: value.savingsNote || null,
    description: value.description || null,
    image_url: value.imageUrl || null,
    features: value.features,
    is_highlighted: value.isHighlighted,
    is_active: value.isActive,
    sort_order: value.sortOrder,
    addon_discount_percent: value.addonDiscountPercent,
    free_addon_id: value.freeAddonId || null,
    updated_at: new Date().toISOString(),
  };
}

async function clearOtherHighlights(exceptId?: string) {
  const { data } = await base.getList<{ id: string }>({
    resource: BOX_PLANS_RESOURCE,
    pagination: { mode: "off" },
    filters: [{ field: "is_highlighted", operator: "eq", value: true }],
    meta: { select: "id" },
  });
  for (const row of data) {
    if (exceptId != null && String(row.id) === exceptId) continue;
    const result = await base.update<{ id: string }>({
      resource: BOX_PLANS_RESOURCE,
      id: row.id,
      variables: {
        is_highlighted: false,
        updated_at: new Date().toISOString(),
      },
    });
    if (!result.data?.id)
      throw new Error("تعذّر إزالة علامة الأكثر اختيارًا من الخطة السابقة.");
  }
}

const unavailable = async (): Promise<never> => {
  throw new Error("هذا الإجراء غير متاح لخطط صندوق الرحلة.");
};

export const boxPlansDataProvider: DataProvider = {
  ...base,
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: Parameters<DataProvider["getList"]>[0],
  ) => {
    if (params.resource === addonOptionsResource) {
      await assertResourceAccess(BOX_PLANS_RESOURCE, "list");
      return base.getList<TData>({
        ...params,
        resource: "addon_products",
        pagination: { mode: "off" },
        sorters: [{ field: "name", order: "asc" }],
        meta: { select: "id,name,is_active" },
      });
    }
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "list");
    return base.getList<TData>(params);
  },
  getOne: async (params) => {
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "show", { id: params.id });
    return base.getOne(params);
  },
  getMany: async (params) => {
    if (params.resource === addonOptionsResource) {
      await assertResourceAccess(BOX_PLANS_RESOURCE, "list");
      return base.getMany({
        ...params,
        resource: "addon_products",
        meta: { select: "id,name,is_active" },
      });
    }
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "list");
    return base.getMany(params);
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: CreateParams<TVariables>,
  ) => {
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "create");
    const variables = toDatabaseRow(params.variables);
    if (variables.is_highlighted) await clearOtherHighlights();
    const result = await base.create<TData>({ ...params, variables });
    if (!result.data?.id)
      throw new Error("تعذّر تأكيد حفظ خطة صندوق الرحلة.");
    await writeAudit("box_plan_created", String(result.data.id));
    return result;
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: UpdateParams<TVariables>,
  ) => {
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "edit", { id: params.id });
    const variables = toDatabaseRow(params.variables);
    if (variables.is_highlighted)
      await clearOtherHighlights(String(params.id));
    const result = await base.update<TData>({ ...params, variables });
    if (!result.data?.id)
      throw new Error("الخطة غير موجودة أو تعذّر تأكيد حفظها.");
    await writeAudit("box_plan_updated", String(result.data.id));
    return result;
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord>(
    params: Parameters<DataProvider["deleteOne"]>[0],
  ) => {
    assertPlanResource(params.resource);
    await assertResourceAccess(BOX_PLANS_RESOURCE, "delete", { id: params.id });
    const result = await base.deleteOne(params);
    await writeAudit("box_plan_deleted", String(params.id));
    return { data: result.data as TData };
  },
  createMany: unavailable,
  updateMany: unavailable,
  deleteMany: unavailable,
  custom: unavailable,
};
