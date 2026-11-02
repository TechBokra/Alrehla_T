import assert from "node:assert/strict";
import test from "node:test";
import { FormApi, FieldApi, revalidateLogic } from "@tanstack/react-form";
import { createResourceFormBaseline } from "../src/hooks/resources/crud/form-baseline.ts";
import { submitResourceForm } from "../src/hooks/resources/page/form-submission.ts";
import { productPageSchema } from "../src/features/catalog/products/form-page/schema.ts";
import { valuesFromProduct } from "../src/features/catalog/products/form-page/values.ts";

for (const coverUrl of [null, "https://images.test/new-cover.jpg"]) {
  test(`validation correction, save and the next TanStack render retain the saved cover (${coverUrl ?? "removed"})`, async () => {
    const original = {
      id: "product-1", name: "Original name", category: "library", price: 100,
      is_active: false, cover_image_url: "https://images.test/original.jpg", gallery_image_urls: [],
    };
    const baseline = createResourceFormBaseline(valuesFromProduct(original));
    let persisted = original;
    let saves = 0;
    const guard = { pending: false };
    const errors = [];
    const options = () => ({
      defaultValues: baseline.defaultValues,
      validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
      validators: { onDynamic: productPageSchema },
      onSubmit: async ({ value, formApi }) => {
        await submitResourceForm({
          prepare: () => {
            const parsed = productPageSchema.parse(value);
            return { name: parsed.name, cover_image_url: parsed.images[0]?.url ?? null };
          },
          reset: (row) => baseline.reset(formApi, valuesFromProduct(row)),
        }, {
          save: async (payload) => { saves++; persisted = { ...original, ...payload }; return persisted; },
          invalidate: async () => {},
          refreshRecord: async () => persisted,
          clearUploads: () => {},
          getLastError: () => undefined,
          getErrorMessage: () => "save failed",
          notifyError: (message) => errors.push(message),
        }, guard);
      },
    });
    const form = new FormApi(options());
    const unmount = form.mount();
    const name = new FieldApi({ form, name: "name" });
    const unmountName = name.mount();
    try {
      form.setFieldValue("name", "");
      await form.handleSubmit();
      assert.equal(saves, 0, "invalid values must not reach the mutation");
      assert.equal(form.state.isValid, false);

      form.setFieldValue("name", "Updated name");
      form.setFieldValue("images", coverUrl ? [{ kind: "saved", url: coverUrl }] : []);
      form.update(options());
      await form.handleSubmit();
      assert.equal(saves, 1);
      assert.equal(persisted.name, "Updated name");
      assert.equal(persisted.cover_image_url, coverUrl);

      // useAppForm calls FormApi.update(options) in its layout effect after render.
      form.update(options());
      assert.deepEqual(form.state.values, valuesFromProduct(persisted));
      assert.equal(form.state.isDirty, false);
      assert.equal(form.state.isValid, true);
      assert.deepEqual(errors, []);

      form.setFieldValue("name", "Unsaved next edit");
      form.update(options());
      assert.equal(form.state.values.name, "Unsaved next edit");
      assert.equal(form.state.isDirty, true);
    } finally {
      unmountName();
      unmount();
    }
  });
}
