import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  MetaQuery,
  UpdateParams,
} from "@refinedev/core";
import { z } from "zod";
import { adminDataProvider as base } from "./supabase-data-provider";
import { assertResourceAccess } from "../access-control-provider";
import { adminAuthProvider } from "../auth-provider";

const targetType = z.enum([
  "product_printed",
  "product_electronic",
  "addon",
  "box_plan",
]);
const targets = {
  product_printed: {
    resource: "personalized_products",
    select: "id,name,price",
    price: "price",
  },
  product_electronic: {
    resource: "personalized_products",
    select: "id,name,price:electronic_price",
    price: "electronic_price",
  },
  addon: {
    resource: "addon_products",
    select: "id,name,price",
    price: "price",
  },
  box_plan: {
    resource: "box_subscription_plans",
    select: "id,name,price:price_total",
    price: "price_total",
  },
} as const;
function target(meta?: MetaQuery) {
  return targets[targetType.parse(meta?.targetType)];
}
function assertResource(resource: string) {
  if (resource !== "price_promotions")
    throw new Error("هذا الإجراء غير متاح للعروض.");
}
const payloadSchema = z
  .object({
    target_type: targetType,
    target_id: z.string().trim().min(1),
    kind: z.enum(["percent", "sale_price"]),
    value: z.number().int().positive(),
    label: z.string().trim().max(60).nullable(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "percent" && value.value >= 100)
      ctx.addIssue({ code: "custom", message: "الخصم أقل من ١٠٠٪" });
    if (Date.parse(value.ends_at) <= Date.parse(value.starts_at))
      ctx.addIssue({ code: "custom", message: "النهاية بعد البداية" });
  });
async function checkedPayload(input: unknown, creating: boolean) {
  const value = payloadSchema.parse(input);
  const config = targets[value.target_type];
  const { data } = await base.getOne<{
    id: string;
    name: string;
    price: number | null;
  }>({
    resource: config.resource,
    id: value.target_id,
    meta: { select: config.select },
  });
  const price = data?.price == null ? NaN : Number(data.price);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error("العنصر غير موجود أو ليس له سعر صالح للعرض.");
  if (value.kind === "sale_price" && value.value >= price)
    throw new Error("سعر العرض يجب أن يكون أقل من السعر الأصلي الحالي.");
  if (creating && Date.parse(value.ends_at) <= Date.now())
    throw new Error("تاريخ نهاية العرض فات بالفعل.");
  return value;
}
const unavailable = async (): Promise<never> => {
  throw new Error("استخدم نافذة العرض أو أوقفه بدلًا من حذفه.");
};

export const promotionsDataProvider: DataProvider = {
  ...base,
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: Parameters<DataProvider["getList"]>[0],
  ) => {
    await assertResourceAccess("price_promotions", "list");
    if (params.resource === "promotion_targets") {
      const config = target(params.meta);
      return base.getList<TData>({
        ...params,
        resource: config.resource,
        filters: [
          ...(params.filters ?? []),
          ...(params.meta?.targetType === "product_electronic"
            ? [{ field: "electronic_price", operator: "gt" as const, value: 0 }]
            : []),
        ],
        meta: { select: config.select },
      });
    }
    assertResource(params.resource);
    const result = await base.getList<TData>(params);
    const rows = result.data as Array<
      TData & { target_type: string; target_id: string }
    >;
    const names = new Map<string, string>();
    await Promise.all(
      Object.entries(targets).map(async ([type, config]) => {
        const ids = [
          ...new Set(
            rows
              .filter((row) => row.target_type === type)
              .map((row) => row.target_id),
          ),
        ];
        if (!ids.length) return;
        const linked = await base.getMany<{ id: string; name: string }>({
          resource: config.resource,
          ids,
          meta: { select: "id,name" },
        });
        for (const row of linked.data) names.set(`${type}:${row.id}`, row.name);
      }),
    );
    return {
      ...result,
      data: rows.map((row) => ({
        ...row,
        target_name: names.get(`${row.target_type}:${row.target_id}`) ?? null,
      })),
    };
  },
  getOne: async (params) => {
    await assertResourceAccess("price_promotions", "show", { id: params.id });
    assertResource(params.resource);
    return base.getOne(params);
  },
  getMany: async (params) => {
    await assertResourceAccess("price_promotions", "list");
    if (params.resource === "promotion_targets") {
      const config = target(params.meta);
      return base.getMany({
        ...params,
        resource: config.resource,
        meta: { select: config.select },
      });
    }
    assertResource(params.resource);
    return base.getMany(params);
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: CreateParams<TVariables>,
  ) => {
    assertResource(params.resource);
    await assertResourceAccess("price_promotions", "create");
    const variables = await checkedPayload(params.variables, true);
    const actor = await adminAuthProvider.getAuthorization(true);
    if (!actor) throw new Error("تعذّر التحقق من الحساب.");
    const result = await base.create<TData>({
      ...params,
      variables: { ...variables, is_active: true, created_by: actor.id },
    });
    if (!result.data?.id)
      throw new Error(
        "تعذّر تأكيد حفظ العرض. حدّث القائمة قبل إعادة المحاولة.",
      );
    return result;
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: UpdateParams<TVariables>,
  ) => {
    assertResource(params.resource);
    await assertResourceAccess("price_promotions", "edit", { id: params.id });
    const toggle = z
      .object({ is_active: z.boolean() })
      .strict()
      .safeParse(params.variables);
    const variables = toggle.success
      ? toggle.data
      : await checkedPayload(params.variables, false);
    const result = await base.update<TData>({
      ...params,
      variables: { ...variables, updated_at: new Date().toISOString() },
    });
    if (!result.data?.id)
      throw new Error("العرض غير موجود أو تعذّر تأكيد حفظه.");
    return result;
  },
  deleteOne: unavailable,
  deleteMany: unavailable,
  createMany: unavailable,
  updateMany: unavailable,
  custom: unavailable,
};
