import type {
  BaseKey,
  BaseRecord,
  CreateParams,
  DataProvider,
  MetaQuery,
  UpdateParams,
} from "@refinedev/core";
import { z } from "zod";

const rank = z.number().int().min(-2147483648).max(2147483647);
const common = {
  is_active: z.boolean(),
  sort_order: rank.optional(),
  updated_at: z.string().datetime().optional(),
  applies_to: z.array(z.string().trim().min(1)).min(1).max(100).nullable(),
};
const fields = z.object({
  ...common,
  label: z.string().trim().min(1).max(80),
  placeholder: z.string().trim().max(120).nullable(),
  is_required: z.boolean(),
});
const goals = z.object({
  ...common,
  label: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((label) => label.toLowerCase() !== "other", "هذه الكلمة محجوزة"),
});
const dialects = z.object({
  code: z.string().regex(/^[a-z_]{2,20}$/),
  name_ar: z.string().trim().min(1).max(60),
  is_active: z.boolean(),
  sort_order: rank.optional(),
});

function resourceMeta(resource: string, meta?: MetaQuery) {
  if (
    !["customization_fields", "story_goals", "writing_dialects"].includes(
      resource,
    )
  )
    throw new Error("مورد إعدادات الكتالوج غير متاح.");
  // Refine requires an id; the existing table uses an immutable code primary key.
  return resource === "writing_dialects"
    ? {
        ...meta,
        idColumnName: "code",
        select: "id:code,code,name_ar,is_active,sort_order",
      }
    : meta;
}

function writeValues(resource: string, variables: unknown, creating: boolean) {
  const schema =
    resource === "customization_fields"
      ? fields
      : resource === "story_goals"
        ? goals
        : dialects;
  return creating
    ? schema.strict().parse(variables)
    : (resource === "writing_dialects"
        ? dialects.omit({ code: true }).partial()
        : schema.partial()
      )
        .strict()
        .parse(variables);
}

export function createCatalogSettingsDataProvider(
  base: Required<DataProvider>,
  authorize: (
    resource: string,
    action: "create" | "edit" | "delete",
    id?: BaseKey,
  ) => Promise<void>,
): DataProvider {
  return {
    ...base,
    getList: async (params) =>
      base.getList({
        ...params,
        meta: resourceMeta(params.resource, params.meta),
        sorters: params.sorters?.map((sorter) =>
          params.resource === "writing_dialects" && sorter.field === "id"
            ? { ...sorter, field: "code" }
            : sorter,
        ),
      }),
    getOne: async (params) =>
      base.getOne({
        ...params,
        meta: resourceMeta(params.resource, params.meta),
      }),
    getMany: async (params) =>
      base.getMany({
        ...params,
        meta: resourceMeta(params.resource, params.meta),
      }),
    create: async <TData extends BaseRecord, TVariables>(
      params: CreateParams<TVariables>,
    ) => {
      const meta = resourceMeta(params.resource, params.meta);
      await authorize(params.resource, "create");
      const variables = writeValues(params.resource, params.variables, true);
      const limit =
        params.resource === "customization_fields"
          ? 15
          : params.resource === "story_goals"
            ? 30
            : undefined;
      if (limit) {
        const current = await base.getList({
          resource: params.resource,
          pagination: { currentPage: 1, pageSize: 1 },
          meta,
        });
        if (current.total >= limit)
          throw new Error(
            `وصلت للحد الأقصى (${limit}). عدّل العناصر الموجودة بدل إضافة عناصر جديدة.`,
          );
      }
      const result = await base.create<TData>({ ...params, variables, meta });
      if (!result.data?.id)
        throw new Error(
          "لم يتم تأكيد حفظ السجل. حدّث القائمة قبل المحاولة مرة أخرى.",
        );
      return result;
    },
    update: async <TData extends BaseRecord, TVariables>(
      params: UpdateParams<TVariables>,
    ) => {
      const meta = resourceMeta(params.resource, params.meta);
      await authorize(params.resource, "edit", params.id);
      const variables = writeValues(params.resource, params.variables, false);
      const result = await base.update<TData>({ ...params, variables, meta });
      if (!result.data?.id)
        throw new Error(
          "السجل غير موجود أو لم تسمح الصلاحيات بحفظه. حدّث القائمة.",
        );
      return result;
    },
    deleteOne: async (params) => {
      const meta = resourceMeta(params.resource, params.meta);
      await authorize(params.resource, "delete", params.id);
      return base.deleteOne({ ...params, meta });
    },
    createMany: async () => {
      throw new Error("أضف كل عنصر من نافذة الإضافة.");
    },
    updateMany: async () => {
      throw new Error("استخدم نافذة التعديل أو ترتيب القائمة.");
    },
    deleteMany: async () => {
      throw new Error("احذف كل عنصر من إجراءاته.");
    },
    custom: async () => {
      throw new Error("هذا الإجراء غير متاح لإعدادات الكتالوج.");
    },
  };
}
