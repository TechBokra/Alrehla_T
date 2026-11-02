import assert from "node:assert/strict";
import test from "node:test";
import { updateResourceBooleanField } from "../src/hooks/resources/crud/boolean-field-update.ts";

function fixture(overrides = {}) {
  const record = { id: "product-1", is_active: false, name: "Book", owner_type: "platform" };
  const events = [];
  const request = {
    id: record.id, field: "is_active", value: true, record,
    allowedFields: ["is_active"], canEditRecord: (row) => row.owner_type === "platform",
    ...overrides,
  };
  return {
    events, request, guard: { pending: false },
    services: {
      authorize: async () => { events.push("authorize"); },
      read: async () => { events.push("read"); return record; },
      update: async (values) => { events.push({ update: values }); return { ...record, ...values }; },
      invalidate: async () => { events.push("invalidate"); },
    },
  };
}

for (const current of [true, false]) {
  test(`a ${current} boolean switches to ${!current} with only that field in the payload`, async () => {
    const f = fixture({ record: { id: "product-1", is_active: current, owner_type: "platform" }, value: !current });
    f.services.read = async () => { f.events.push("read"); return f.request.record; };
    f.services.update = async (payload) => { f.events.push({ update: payload }); return { ...f.request.record, ...payload }; };
    const result = await updateResourceBooleanField(f.request, f.services, f.guard);
    assert.deepEqual(result, { changed: true, refreshFailed: false });
    assert.deepEqual(f.events, ["authorize", "read", "authorize", { update: { is_active: !current } }, "invalidate"]);
    assert.equal(f.guard.pending, false);
  });
}

test("unregistered fields, protected identifiers and nonboolean inputs make no requests", async () => {
  for (const overrides of [{ allowedFields: [] }, { field: "id", allowedFields: ["id"] }, { value: "true" }, { record: { id: "product-1", is_active: null, owner_type: "platform" } }]) {
    const f = fixture(overrides);
    await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard));
    assert.deepEqual(f.events, []);
    assert.equal(f.guard.pending, false);
  }
});

test("cached record restrictions deny before a provider read", async () => {
  const f = fixture({ canEditRecord: () => false });
  await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard));
  assert.deepEqual(f.events, []);
});

test("a newly ineligible record cannot be updated after the fresh read", async () => {
  const f = fixture();
  f.services.read = async () => ({ ...f.request.record, owner_type: "publisher" });
  await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard));
  assert.deepEqual(f.events, ["authorize"]);
});

test("fresh authorization denial prevents mutation", async () => {
  const f = fixture();
  let checks = 0;
  f.services.authorize = async () => { if (++checks === 2) throw new Error("denied"); };
  await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard), /denied/);
  assert.deepEqual(f.events, ["read"]);
});

test("a stale value refreshes the table and requires an intentional retry", async () => {
  const f = fixture();
  f.services.read = async () => ({ ...f.request.record, is_active: true });
  await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard), /تغيّرت/);
  assert.deepEqual(f.events, ["authorize", "authorize", "invalidate"]);
});

test("a failed mutation refreshes without replay, preserves the original value and releases the guard", async () => {
  const f = fixture();
  let writes = 0;
  f.services.update = async () => { writes++; throw new Error("backend failed"); };
  await assert.rejects(updateResourceBooleanField(f.request, f.services, f.guard), /backend failed/);
  assert.equal(writes, 1);
  assert.equal(f.request.record.is_active, false);
  assert.equal(f.guard.pending, false);
  assert.equal(f.events.at(-1), "invalidate");
  f.services.update = async (payload) => ({ ...f.request.record, ...payload });
  assert.deepEqual(await updateResourceBooleanField(f.request, f.services, f.guard), { changed: true, refreshFailed: false });
});

test("a double click during preflight executes one mutation", async () => {
  const f = fixture();
  let continueAuthorization;
  let checks = 0;
  f.services.authorize = () => ++checks === 1 ? new Promise((resolve) => { continueAuthorization = resolve; }) : Promise.resolve();
  const first = updateResourceBooleanField(f.request, f.services, f.guard);
  assert.equal(await updateResourceBooleanField(f.request, f.services, f.guard), false);
  continueAuthorization();
  await first;
  assert.equal(f.events.filter((event) => typeof event === "object").length, 1);
});

test("refresh failure reports a saved change and never repeats the update", async () => {
  const f = fixture();
  f.services.invalidate = async () => { throw new Error("offline"); };
  assert.deepEqual(await updateResourceBooleanField(f.request, f.services, f.guard), { changed: true, refreshFailed: true });
  assert.equal(f.events.filter((event) => typeof event === "object").length, 1);
});

test("an unchanged value is a no-op and unexpected saved values are not reported as success", async () => {
  const noop = fixture({ value: false });
  assert.deepEqual(await updateResourceBooleanField(noop.request, noop.services, noop.guard), { changed: false, refreshFailed: false });
  assert.deepEqual(noop.events, []);
  const wrongResponse = fixture();
  wrongResponse.services.update = async () => wrongResponse.request.record;
  await assert.rejects(updateResourceBooleanField(wrongResponse.request, wrongResponse.services, wrongResponse.guard), /تأكيد/);
  assert.equal(wrongResponse.events.at(-1), "invalidate");
});
