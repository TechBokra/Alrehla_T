import { z } from "zod";

const targets = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(100)
  .refine((value) => new Set(value).size === value.length);
const changeSchema = z
  .object({
    resource: z.enum(["customization_fields", "story_goals"]),
    id: z.string().trim().min(1),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    expectedAppliesTo: targets,
    appliesTo: targets,
  })
  .strict();
const inputSchema = z
  .object({
    productId: z.string().trim().min(1),
    changes: z.array(changeSchema).min(1).max(200),
  })
  .strict();

export type PersonalizationResource = z.infer<typeof changeSchema>["resource"];
export type PersonalizationScopeChange = z.infer<typeof changeSchema>;
export type PersonalizationScopeRow = {
  id: string;
  updated_at: string;
  applies_to: string[] | null;
};
export type PersonalizationProduct = {
  id: string;
  owner_type: string;
  category: string;
};
export type PersonalizationSaveResult = {
  results: Array<{
    resource: PersonalizationResource;
    id: string;
    ok: boolean;
    error?: string;
  }>;
  succeeded: number;
  failed: number;
};
export interface PersonalizationServices {
  authorizeProduct: (id: string) => Promise<void>;
  readProduct: (id: string) => Promise<PersonalizationProduct | undefined>;
  authorizeDefinition: (
    resource: PersonalizationResource,
    id: string,
  ) => Promise<void>;
  readDefinitions: (
    resource: PersonalizationResource,
    ids: string[],
  ) => Promise<PersonalizationScopeRow[]>;
  /** Must condition the update on both the expected timestamp and target set. */
  writeScope: (
    change: PersonalizationScopeChange,
  ) => Promise<PersonalizationScopeRow | undefined>;
}

function sameTargets(actual: string[] | null, expected: string[]) {
  if (!actual || actual.length !== expected.length) return false;
  const members = new Set(actual);
  return (
    members.size === expected.length && expected.every((id) => members.has(id))
  );
}

const conflict =
  "تغيّر نطاق بعض التعريفات. حدّث النطاقات وراجع اختياراتك قبل الحفظ.";

/** Validate the whole plan before writing; individual writes remain nontransactional. */
export async function saveProductPersonalization(
  payload: unknown,
  services: PersonalizationServices,
): Promise<PersonalizationSaveResult> {
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success)
    throw new Error(
      "طلب تخصيص المنتج غير صالح. حدّث البيانات وراجع الاختيارات.",
    );
  const { productId, changes } = parsed.data;
  const keys = new Set(
    changes.map((change) => `${change.resource}:${change.id}`),
  );
  if (keys.size !== changes.length)
    throw new Error("تكررت تعريفات في طلب الحفظ.");

  await services.authorizeProduct(productId);
  const product = await services.readProduct(productId);
  if (
    !product ||
    product.id !== productId ||
    product.owner_type !== "platform" ||
    !["library", "custom"].includes(product.category)
  )
    throw new Error("هذا المنتج غير متاح لتعديل خيارات التخصيص.");
  await Promise.all(
    changes.map((change) =>
      services.authorizeDefinition(change.resource, change.id),
    ),
  );

  const resources = ["customization_fields", "story_goals"] as const;
  const snapshots = await Promise.all(
    resources.map(async (resource) => {
      const ids = changes
        .filter((change) => change.resource === resource)
        .map((change) => change.id);
      return {
        resource,
        rows: ids.length ? await services.readDefinitions(resource, ids) : [],
      };
    }),
  );
  const latest = new Map(
    snapshots.flatMap(({ resource, rows }) =>
      rows.map((row) => [`${resource}:${row.id}`, row] as const),
    ),
  );
  for (const change of changes) {
    const row = latest.get(`${change.resource}:${change.id}`);
    if (
      !row ||
      row.updated_at !== change.expectedUpdatedAt ||
      !sameTargets(row.applies_to, change.expectedAppliesTo)
    )
      throw new Error(conflict);
    const hadProduct = change.expectedAppliesTo.includes(productId);
    const wantsProduct = change.appliesTo.includes(productId);
    const expected = wantsProduct
      ? [...change.expectedAppliesTo, productId]
      : change.expectedAppliesTo.filter((id) => id !== productId);
    if (
      hadProduct === wantsProduct ||
      expected.length === 0 ||
      expected.length > 100 ||
      !sameTargets(change.appliesTo, expected)
    )
      throw new Error(
        "لا يمكن تغيير روابط المنتجات الأخرى أو ترك نطاق فارغ من صفحة المنتج.",
      );
  }

  const results: PersonalizationSaveResult["results"] = [];
  for (const change of changes) {
    try {
      await services.authorizeDefinition(change.resource, change.id);
      const saved = await services.writeScope(change);
      if (
        !saved ||
        saved.id !== change.id ||
        !sameTargets(saved.applies_to, change.appliesTo)
      )
        throw new Error(conflict);
      results.push({ resource: change.resource, id: change.id, ok: true });
    } catch (error) {
      const message =
        error instanceof Error && /[\u0600-\u06ff]/.test(error.message)
          ? error.message
          : "تعذّر تأكيد حفظ النطاق. حدّث البيانات قبل إعادة المحاولة.";
      results.push({
        resource: change.resource,
        id: change.id,
        ok: false,
        error: message,
      });
    }
  }
  const succeeded = results.filter((result) => result.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}
