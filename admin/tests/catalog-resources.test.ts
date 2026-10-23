import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  catalogSchema,
  addonSchema,
  defaultCatalogValues,
  productSlug,
  catalogError,
} from "../src/features/catalog/model";
import {
  productCreate,
  productUpdate,
  productValues,
  isEditableProduct,
  type Product,
} from "../src/features/catalog/products/model";
import {
  addonCreate,
  addonUpdate,
  addonValues,
  type Addon,
} from "../src/features/catalog/addons/model";
import {
  createSubmissionGuard,
  closeDecision,
  editRecordState,
  refreshSavedResource,
} from "../src/components/resources/lifecycle";
import { resolveAdminPath } from "../src/features/auth/router-provider";

const valid = () => ({
  ...defaultCatalogValues(),
  name: "قصة الطفل",
  price: "125.50",
});
test("product validation rejects invalid names, nonfinite/nonpositive prices, unsupported category and unsafe URLs", () => {
  for (const change of [
    { name: "ا" },
    { name: "ا".repeat(121) },
    { price: "" },
    { price: "-1" },
    { price: "0" },
    { price: "Infinity" },
    { price: "NaN" },
    { category: "subscription" },
    { imageUrl: "javascript:alert(1)" },
    { sortOrder: "1.5" },
    { description: "x".repeat(601) },
    { longDescription: "x".repeat(5001) },
  ]) {
    assert.equal(
      catalogSchema.safeParse({ ...valid(), ...change }).success,
      false,
      JSON.stringify(change),
    );
  }
  assert.equal(
    catalogSchema.safeParse({ ...valid(), electronicPrice: "" }).success,
    true,
  );
  assert.equal(
    catalogSchema.safeParse({
      ...valid(),
      imageUrl: "https://example.com/image.jpg",
    }).success,
    true,
  );
});
test("new products are inactive approved platform products even when input says active", () => {
  const payload = productCreate({ ...valid(), isActive: true });
  assert.equal(payload.is_active, false);
  assert.equal(payload.owner_type, "platform");
  assert.equal(payload.publisher_id, null);
  assert.equal(payload.review_status, "approved");
  assert.match(payload.slug, /^قصة-الطفل-[\da-f]{8}$/);
});
test("updates allowlist fields, preserve slug and omit untouched metadata", () => {
  const payload = productUpdate({
    ...valid(),
    features: ["overwrite"],
    slug: "replace",
    publisher_id: "other",
    review_status: "rejected",
  } as ReturnType<typeof valid>);
  for (const key of [
    "slug",
    "features",
    "gallery_image_urls",
    "min_age",
    "max_age",
    "writing_styles",
    "owner_type",
    "publisher_id",
    "publisher_cost",
    "pending_changes",
    "review_status",
    "reviewed_at",
  ])
    assert.equal(key in payload, false, key);
  assert.equal(payload.price, 125.5);
  assert.equal("electronic_price" in payload, false);
  assert.equal(
    productUpdate({ ...valid(), category: "custom", electronicPrice: "25" })
      .electronic_price,
    25,
  );
  assert.equal(
    productUpdate({ ...valid(), category: "custom", electronicPrice: "" })
      .electronic_price,
    null,
  );
});
test("publisher records and subscription products cannot enter platform editing", () => {
  assert.equal(
    isEditableProduct({
      owner_type: "publisher",
      category: "library",
    } as Product),
    false,
  );
  assert.equal(
    isEditableProduct({
      owner_type: "platform",
      category: "subscription",
    } as Product),
    false,
  );
  assert.equal(
    isEditableProduct({
      owner_type: "platform",
      category: "custom",
    } as Product),
    true,
  );
});
test("add-on validation respects customization, image and price constraints", () => {
  assert.equal(addonSchema.safeParse({ ...valid(), price: "0" }).success, true);
  assert.equal(
    addonSchema.safeParse({ ...valid(), imageUrl: "https://example.com/a.jpg" })
      .success,
    false,
  );
  const payload = addonCreate({
    ...valid(),
    imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg",
    isActive: true,
  });
  assert.equal(payload.is_active, false);
  assert.equal(payload.supports_customization, true);
  assert.equal(payload.customization_price, 0);
  const update = addonUpdate(valid());
  for (const key of ["slug", "gallery_image_urls", "features"])
    assert.equal(key in update, false);
});
test("record adapters retain false/zero values and create returns independent clean defaults", () => {
  const first = defaultCatalogValues();
  first.name = "changed";
  assert.equal(defaultCatalogValues().name, "");
  assert.equal(
    productValues({
      name: "A",
      category: "custom",
      price: 25,
      electronic_price: null,
      is_active: false,
      sort_order: 0,
    } as Product).electronicPrice,
    "",
  );
  assert.equal(
    addonValues({
      name: "A",
      price: 0,
      is_active: false,
      sort_order: 0,
    } as Addon).price,
    "0",
  );
  assert.equal(
    productSlug("  مرحبًا بالعالم  ", "12345678"),
    "مرحب-ا-بالعالم-12345678",
  );
});
test("submission guard prevents duplicates but allows a failed save to be retried", async () => {
  const guard = createSubmissionGuard();
  let writes = 0;
  const write = async () => {
    if (!guard.begin()) return;
    writes++;
    await Promise.resolve();
    guard.completed();
  };
  await Promise.all([write(), write()]);
  await write();
  assert.equal(writes, 1);
  const failed = createSubmissionGuard();
  assert.equal(failed.begin(), true);
  failed.failed();
  assert.equal(failed.begin(), true);
  failed.completed();
  assert.equal(failed.begin(), false);
});
test("pending dismissal is blocked and dirty dismissal requires confirmation", () => {
  assert.equal(closeDecision(true, true), "stay");
  assert.equal(closeDecision(true, false), "stay");
  assert.equal(closeDecision(false, true), "confirm");
  assert.equal(closeDecision(false, false), "close");
});
test("cache refresh failure does not turn an acknowledged save into a failed business action", async () => {
  let invalidations = 0;
  assert.equal(
    await refreshSavedResource(async () => {
      invalidations++;
    }),
    true,
  );
  assert.equal(invalidations, 1);
  assert.equal(
    await refreshSavedResource(async () => {
      throw new Error("offline");
    }),
    false,
  );
});
test("edit loading, missing, unauthorized and failed reads are distinct", () => {
  const base = {
    loading: false,
    canEdit: (row: { allowed: boolean }) => row.allowed,
  };
  assert.equal(editRecordState({ ...base, loading: true }), "loading");
  assert.equal(editRecordState(base), "missing");
  assert.equal(
    editRecordState({ ...base, error: { statusCode: 403 } }),
    "forbidden",
  );
  assert.equal(
    editRecordState({ ...base, record: { allowed: false } }),
    "forbidden",
  );
  assert.equal(
    editRecordState({ ...base, error: { code: "PGRST116" } }),
    "missing",
  );
  assert.equal(
    editRecordState({ ...base, error: { statusCode: 500 } }),
    "failed",
  );
  assert.equal(
    editRecordState({ ...base, record: { allowed: true } }),
    "ready",
  );
});
test("permission and slug errors produce actionable messages", () => {
  assert.match(catalogError({ code: "42501" }), /صلاحية/);
  assert.match(catalogError({ statusCode: 403 }), /صلاحية/);
  assert.match(catalogError({ code: "23505" }), /رابط/);
});
test("router supports resource links and preserves fixed auth redirects", () => {
  for (const path of [
    "/theme",
    "/sign-in",
    "/catalog/products",
    "/catalog/addons",
  ])
    assert.equal(resolveAdminPath(path + "/"), path);
  assert.equal(resolveAdminPath("https://example.com"), "/sign-in");
});
test("live pages use root provider and demos retain their own contexts", async () => {
  const read = (path: string) =>
    readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  assert.match(
    await read("routes/__root.tsx"),
    /resources=\{catalogResources\}/,
  );
  assert.doesNotMatch(
    await read("routes/catalog/route.tsx"),
    /<Refine|ShowcaseLayout/,
  );
  assert.match(
    await read("features/component-showcase/layout.tsx"),
    /dataProvider=\{previewDataProvider\}/,
  );
  assert.match(
    await read("features/form-prototype/refine-demo.tsx"),
    /dataProvider=\{provider\}/,
  );
  assert.match(
    await read("features/catalog/products/page.tsx"),
    /field: "owner_type", operator: "eq", value: "platform"/,
  );
});
