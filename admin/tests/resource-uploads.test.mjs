import assert from "node:assert/strict";
import test from "node:test";
import {
  getPendingCloudinaryUploadIds,
  resolveCloudinaryUploads,
  resolveImageSelectionUrls,
} from "../src/hooks/uploads/resource-upload-utils.ts";

function fakeUploader(initial, finish) {
  const items = new Map(initial.map((item) => [item.id, { issues: [], ...item }]));
  const listeners = new Set();
  let started = [];
  return {
    getItem: (id) => items.get(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(ids) {
      started = [...ids];
      for (const id of ids) items.get(id).status = "uploading";
      queueMicrotask(() => {
        finish(items, ids);
        for (const listener of listeners) listener();
      });
    },
    started: () => started,
  };
}

test("selected image uploads wait for success and return saved plus new URLs", async () => {
  const uploader = fakeUploader(
    [{ id: "cover-1", status: "idle", result: undefined }],
    (items, ids) => {
      for (const id of ids) {
        items.get(id).status = "success";
        items.get(id).result = { secure_url: "https://images.test/cover.jpg" };
      }
    },
  );

  const urls = await resolveImageSelectionUrls(
    (ids) => resolveCloudinaryUploads(uploader, ids),
    [
      { kind: "saved", url: "https://images.test/library.jpg" },
      { kind: "queued", uploadId: "cover-1", name: "cover.jpg" },
    ],
  );

  assert.deepEqual(uploader.started(), ["cover-1"]);
  assert.deepEqual(urls, [
    "https://images.test/library.jpg",
    "https://images.test/cover.jpg",
  ]);
});

test("queued covers are marked active only when the save flow starts resolving them", () => {
  const uploader = fakeUploader(
    [
      { id: "cover-queued", status: "idle", result: undefined },
      { id: "cover-finished", status: "success", result: { secure_url: "https://images.test/old.jpg" } },
    ],
    () => {},
  );
  const beforeSave = new Set();

  assert.equal(beforeSave.has("cover-queued"), false);
  const resolvingIds = new Set(getPendingCloudinaryUploadIds(uploader, ["cover-queued", "cover-finished"]));
  assert.deepEqual([...resolvingIds], ["cover-queued"]);
  assert.equal(resolvingIds.has("cover-queued"), true);
  assert.equal(resolvingIds.has("cover-finished"), false);
});

test("an upload failure rejects the preparation step before save can continue", async () => {
  const uploader = fakeUploader(
    [{ id: "cover-1", status: "idle", result: undefined }],
    (items, ids) => {
      for (const id of ids) {
        items.get(id).status = "error";
        items.get(id).issues = [{ message: "Cloudinary rejected this image." }];
      }
    },
  );
  let recordMutationCalled = false;

  await assert.rejects(
    resolveCloudinaryUploads(uploader, ["cover-1"]).then(() => {
      recordMutationCalled = true;
    }),
    /Cloudinary rejected this image\./,
  );
  assert.equal(recordMutationCalled, false);
});
