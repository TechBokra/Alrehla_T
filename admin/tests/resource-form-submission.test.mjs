import assert from "node:assert/strict";
import test from "node:test";
import { submitResourceForm } from "../src/hooks/resources/page/form-submission.ts";
import { valuesFromProduct } from "../src/features/catalog/products/form-page/values.ts";

const saved = {
  id: "product-1", name: "Book", category: "library", price: 100,
  is_active: false, cover_image_url: "https://images.test/old.jpg", gallery_image_urls: [],
};

function fixture(overrides = {}) {
  const events = [];
  const errors = [];
  const services = {
    save: async () => { events.push("save"); return saved; },
    invalidate: async () => { events.push("invalidate"); },
    refreshRecord: async () => { events.push("refresh"); return saved; },
    clearUploads: () => { events.push("clear"); },
    getLastError: () => new Error("backend failure"),
    getErrorMessage: (error) => `formatted: ${error.message}`,
    notifyError: (message) => { errors.push(message); },
    ...overrides,
  };
  const request = {
    prepare: async () => { events.push("prepare"); return { name: "Book" }; },
    reset: () => { events.push("reset"); },
  };
  return { events, errors, services, request, guard: { pending: false } };
}

for (const coverUrl of [null, "https://images.test/replacement.jpg"]) {
  test(`edit resets from the authoritative cover (${coverUrl ?? "removed"}) after cache refresh`, async () => {
    const f = fixture();
    const refreshed = { ...saved, cover_image_url: coverUrl };
    f.services.refreshRecord = async () => { f.events.push("refresh"); return refreshed; };
    f.request.reset = (row) => {
      f.events.push("reset");
      assert.deepEqual(valuesFromProduct(row).images, coverUrl ? [{ kind: "saved", url: coverUrl }] : []);
    };
    assert.equal(await submitResourceForm(f.request, f.services, f.guard), refreshed);
    assert.deepEqual(f.events, ["prepare", "save", "invalidate", "refresh", "clear", "reset"]);
    assert.deepEqual(f.errors, []);
    assert.equal(f.guard.pending, false);
  });
}

test("failed upload preparation never saves, clears uploads, resets or redirects", async () => {
  const f = fixture();
  f.request.prepare = async () => { throw new Error("تعذّر رفع الصورة."); };
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), false);
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.errors, ["تعذّر رفع الصورة."]);
  assert.equal(f.guard.pending, false);
});

test("a failed backend save keeps form values and allows an intentional retry", async () => {
  const f = fixture();
  f.services.save = async () => false;
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), false);
  assert.deepEqual(f.events, ["prepare"]);
  assert.deepEqual(f.errors, ["formatted: backend failure"]);
  f.services.save = async () => saved;
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), saved);
});

test("a post-save refresh failure reports partial completion without repeating the mutation", async () => {
  const f = fixture({ refreshRecord: async () => { throw new Error("offline"); } });
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), saved);
  assert.deepEqual(f.events, ["prepare", "save", "invalidate", "clear", "reset"]);
  assert.deepEqual(f.errors, ["تم الحفظ، لكن تعذّر إعادة تحميل البيانات."]);
});

test("cache failure still refreshes the saved detail and never repeats the save", async () => {
  const f = fixture({ invalidate: async () => { throw new Error("offline"); } });
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), saved);
  assert.deepEqual(f.events, ["prepare", "save", "refresh", "clear", "reset"]);
  assert.deepEqual(f.errors, ["تم الحفظ، لكن تعذّر تحديث البيانات المعروضة. أعد تحميل الصفحة."]);
});

test("creation resets before redirect and does not read an edit record", async () => {
  const f = fixture({ refreshRecord: undefined });
  f.services.notifySuccess = () => { f.events.push("success"); };
  f.services.redirect = (row) => { assert.equal(row, saved); f.events.push("redirect"); };
  await submitResourceForm(f.request, f.services, f.guard);
  assert.deepEqual(f.events, ["prepare", "save", "invalidate", "clear", "reset", "success", "redirect"]);
});

test("duplicate submissions are blocked throughout preparation", async () => {
  const f = fixture();
  let finishPreparation;
  f.request.prepare = () => new Promise((resolve) => { finishPreparation = resolve; });
  const first = submitResourceForm(f.request, f.services, f.guard);
  assert.equal(await submitResourceForm(f.request, f.services, f.guard), false);
  assert.deepEqual(f.events, []);
  finishPreparation({ name: "Book" });
  await first;
  assert.equal(f.events.filter((event) => event === "save").length, 1);
});
