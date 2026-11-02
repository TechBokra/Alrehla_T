import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DEBOUNCE_MS } from "../src/lib/const.ts";
import { createDropDebouncer, planResourceReorder, persistResourceReorder, readResourceOrder } from "../src/hooks/resources/table/reorder.ts";

const rows = [10, 20, 30, 40, 50].map((sort_order, index) => ({ id: String(index + 1), sort_order }));

test("the fresh snapshot reads all pages even when the server caps page size", async () => {
  const calls = [];
  const snapshot = await readResourceOrder(async (page, pageSize) => {
    calls.push([page, pageSize]);
    const start = (page - 1) * pageSize;
    return { data: rows.slice(start, start + Math.min(pageSize, 2)), total: rows.length };
  });
  assert.deepEqual(snapshot, rows);
  assert.deepEqual(calls, [[1, 500], [2, 2], [3, 2]]);
});

test("an incomplete or changing scoped read fails before updates", async () => {
  await assert.rejects(readResourceOrder(async () => ({ data: [], total: 5 })));
  await assert.rejects(readResourceOrder(async (page) => ({ data: [rows[0]], total: page === 1 ? 5 : 6 })));
});

test("no request before drop; a drop saves only after the shared 300 ms delay", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  assert.equal(DEFAULT_DEBOUNCE_MS, 300);
  const scheduler = createDropDebouncer(DEFAULT_DEBOUNCE_MS);
  const writes = [];
  t.mock.timers.tick(1000);
  assert.deepEqual(writes, []);
  scheduler.schedule(() => writes.push("first drop"));
  t.mock.timers.tick(299);
  assert.deepEqual(writes, []);
  scheduler.schedule(() => writes.push("latest drop"));
  t.mock.timers.tick(299);
  assert.deepEqual(writes, []);
  t.mock.timers.tick(1);
  assert.deepEqual(writes, ["latest drop"]);
});

test("cancelled drops on navigation/unmount do not save", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scheduler = createDropDebouncer(DEFAULT_DEBOUNCE_MS);
  let calls = 0;
  scheduler.schedule(() => calls++);
  scheduler.cancel();
  t.mock.timers.tick(1000);
  assert.equal(calls, 0);
});

test("a later page preserves global rank slots and updates only the affected records", () => {
  const changes = planResourceReorder(rows, rows.slice(2, 4), ["4", "3"], "sort_order");
  assert.deepEqual(changes.map(({ record, position }) => [record.id, position]), [["4", 30], ["3", 40]]);
  assert.deepEqual(rows.map((row) => row.sort_order), [10, 20, 30, 40, 50]);
});

test("duplicate positions normalize the complete scope without moving hidden rows out of sequence", () => {
  const tied = rows.map((row) => ({ ...row, sort_order: 0 }));
  const changes = planResourceReorder(tied, tied.slice(1, 3), ["3", "2"], "sort_order");
  const positions = new Map(changes.map(({ record, position }) => [record.id, position]));
  const sorted = tied.map((row) => ({ ...row, sort_order: positions.get(row.id) ?? row.sort_order }))
    .sort((a, b) => a.sort_order - b.sort_order);
  assert.deepEqual(sorted.map((row) => row.id), ["1", "3", "2", "4", "5"]);
});

test("returning to the original order has no updates", () => {
  assert.deepEqual(planResourceReorder(rows, rows.slice(0, 2), ["1", "2"], "sort_order"), []);
});

test("stale, missing, duplicate IDs and nonnumeric field configuration are rejected before writes", () => {
  assert.throws(() => planResourceReorder(rows, [{ ...rows[0], sort_order: 9 }, rows[1]], ["2", "1"], "sort_order"), /تغيّر/);
  assert.throws(() => planResourceReorder(rows, rows.slice(0, 2), ["2", "2"], "sort_order"));
  assert.throws(() => planResourceReorder(rows.slice(1), rows.slice(0, 2), ["2", "1"], "sort_order"));
  assert.throws(() => planResourceReorder(rows, rows.slice(0, 2), ["2", "1"], "id"));
  assert.throws(() => planResourceReorder(rows.map((row) => ({ ...row, name: "Book" })), rows.slice(0, 2), ["2", "1"], "name"));
});

function fixture(overrides = {}) {
  const events = [];
  return {
    events,
    services: {
      authorize: async (record) => { events.push(record ? `authorize:${record.id}` : "authorize"); },
      read: async () => { events.push("read"); return rows; },
      update: async (record, position) => { events.push(`update:${record.id}:${position}`); },
      invalidate: async () => { events.push("invalidate"); },
      ...overrides,
    },
  };
}

test("fresh authorization precedes writes and one resource invalidation follows the batch", async () => {
  const f = fixture();
  const result = await persistResourceReorder(rows.slice(0, 2), ["2", "1"], "sort_order", f.services);
  assert.deepEqual(result, { updated: 2, refreshFailed: false });
  assert.deepEqual(f.events, ["authorize", "read", "authorize:2", "update:2:10", "authorize:1", "update:1:20", "invalidate"]);
});

test("denied sorting makes no provider reads or writes", async () => {
  const f = fixture({ authorize: async () => { throw new Error("denied"); } });
  await assert.rejects(persistResourceReorder(rows.slice(0, 2), ["2", "1"], "sort_order", f.services), /denied/);
  assert.deepEqual(f.events, []);
});

test("a partial write failure refreshes and reports partial completion without retrying", async () => {
  const f = fixture();
  let writes = 0;
  f.services.update = async () => { writes++; if (writes === 2) throw new Error("failed"); };
  await assert.rejects(persistResourceReorder(rows.slice(0, 2), ["2", "1"], "sort_order", f.services), /جزء/);
  assert.equal(writes, 2);
  assert.equal(f.events.filter((event) => event === "invalidate").length, 1);
});

test("cache refresh failure does not replay successfully saved positions", async () => {
  const f = fixture({ invalidate: async () => { throw new Error("offline"); } });
  const result = await persistResourceReorder(rows.slice(0, 2), ["2", "1"], "sort_order", f.services);
  assert.deepEqual(result, { updated: 2, refreshFailed: true });
  assert.equal(f.events.filter((event) => event.startsWith("update:")).length, 2);
});
