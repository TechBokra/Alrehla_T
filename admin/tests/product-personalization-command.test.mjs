import assert from "node:assert/strict";
import test from "node:test";
import { saveProductPersonalization } from "../src/providers/refine/data-provider/product-personalization-command.ts";
import { planProductScopeChanges } from "../src/features/catalog/products/form-page/personalization-scope.ts";

const timestamp = "2026-11-02T10:00:00+00:00";
const row = (id, applies_to) => ({
  id,
  applies_to,
  updated_at: timestamp,
  label: id,
  is_active: true,
  sort_order: 0,
});
const key = (resource, id) => `${resource}:${id}`;
function fixture(entries) {
  const store = new Map(
    entries.map(([resource, value]) => [
      key(resource, value.id),
      structuredClone(value),
    ]),
  );
  const writes = [];
  const services = {
    authorizeProduct: async () => {},
    readProduct: async (id) => ({
      id,
      owner_type: "platform",
      category: "custom",
    }),
    authorizeDefinition: async () => {},
    readDefinitions: async (resource, ids) =>
      ids.flatMap((id) => {
        const value = store.get(key(resource, id));
        return value ? [structuredClone(value)] : [];
      }),
    writeScope: async (change) => {
      const current = store.get(key(change.resource, change.id));
      if (
        !current ||
        current.updated_at !== change.expectedUpdatedAt ||
        JSON.stringify([...current.applies_to].sort()) !==
          JSON.stringify([...change.expectedAppliesTo].sort())
      )
        return undefined;
      const saved = {
        ...current,
        applies_to: [...change.appliesTo],
        updated_at: "2026-11-02T10:01:00+00:00",
      };
      store.set(key(change.resource, change.id), saved);
      writes.push(change.id);
      return structuredClone(saved);
    },
  };
  return { store, writes, services };
}
function changes(resource, definitions, selected) {
  return planProductScopeChanges(definitions, "p1", selected).map((change) => ({
    ...change,
    resource,
  }));
}

test("scope command preserves other products/box, accepts database timestamp offsets, and reports confirmed writes", async () => {
  const field = row("f", ["p2", "box"]);
  const goal = row("g", ["p1", "p3", "box"]);
  const { services, store } = fixture([
    ["customization_fields", field],
    ["story_goals", goal],
  ]);
  const result = await saveProductPersonalization(
    {
      productId: "p1",
      changes: [
        ...changes("customization_fields", [field], ["f"]),
        ...changes("story_goals", [goal], []),
      ],
    },
    services,
  );
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(store.get(key("customization_fields", "f")).applies_to, [
    "p2",
    "box",
    "p1",
  ]);
  assert.deepEqual(store.get(key("story_goals", "g")).applies_to, [
    "p3",
    "box",
  ]);
});

test("all requested scopes are checked before the first write, including changes without a timestamp bump", async () => {
  const first = row("f", ["p2"]),
    second = row("g", ["box"]);
  const { services, store, writes } = fixture([
    ["customization_fields", first],
    ["story_goals", second],
  ]);
  store.get(key("story_goals", "g")).applies_to.push("another-admin-product");
  await assert.rejects(
    saveProductPersonalization(
      {
        productId: "p1",
        changes: [
          ...changes("customization_fields", [first], ["f"]),
          ...changes("story_goals", [second], ["g"]),
        ],
      },
      services,
    ),
    /تغيّر نطاق/,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(store.get(key("customization_fields", "f")).applies_to, [
    "p2",
  ]);
});

test("global rows, empty scopes, duplicate targets and unrelated scope changes cannot reach writes", async () => {
  for (const [actual, expected, desired] of [
    [null, ["p2"], ["p2", "p1"]],
    [["p1"], ["p1"], []],
    [["p2"], ["p2"], ["p2", "p2", "p1"]],
    [["box", "p2"], ["box", "p2"], ["p1"]],
  ]) {
    const { services, writes } = fixture([["story_goals", row("g", actual)]]);
    await assert.rejects(
      saveProductPersonalization(
        {
          productId: "p1",
          changes: [
            {
              resource: "story_goals",
              id: "g",
              expectedUpdatedAt: timestamp,
              expectedAppliesTo: expected,
              appliesTo: desired,
            },
          ],
        },
        services,
      ),
    );
    assert.deepEqual(writes, []);
  }
});

test("fresh product eligibility and authorization failures abort without mutating scopes", async () => {
  for (const override of [
    { readProduct: async () => undefined },
    {
      readProduct: async () => ({
        id: "p1",
        owner_type: "publisher",
        category: "custom",
      }),
    },
    {
      authorizeProduct: async () => {
        throw new Error("مرفوض");
      },
    },
    {
      authorizeDefinition: async () => {
        throw new Error("مرفوض");
      },
    },
  ]) {
    const field = row("f", ["box"]);
    const { services, writes } = fixture([["customization_fields", field]]);
    await assert.rejects(
      saveProductPersonalization(
        {
          productId: "p1",
          changes: changes("customization_fields", [field], ["f"]),
        },
        { ...services, ...override },
      ),
    );
    assert.deepEqual(writes, []);
  }
});

test("a scope changed after preflight fails CAS and cannot overwrite the concurrent writer", async () => {
  const field = row("f", ["box"]);
  const { services, store } = fixture([["customization_fields", field]]);
  const write = services.writeScope;
  services.writeScope = async (change) => {
    store
      .get(key("customization_fields", "f"))
      .applies_to.push("concurrent-product");
    return write(change);
  };
  const result = await saveProductPersonalization(
    {
      productId: "p1",
      changes: changes("customization_fields", [field], ["f"]),
    },
    services,
  );
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.deepEqual(store.get(key("customization_fields", "f")).applies_to, [
    "box",
    "concurrent-product",
  ]);
});

test("partial failures preserve completed writes and retry from reconciled data writes only remaining intent", async () => {
  const first = row("a", ["box"]),
    second = row("b", ["p2"]);
  const { services, store, writes } = fixture([
    ["customization_fields", first],
    ["customization_fields", second],
  ]);
  const write = services.writeScope;
  let fail = true;
  services.writeScope = async (change) => {
    if (change.id === "b" && fail) {
      fail = false;
      throw new Error("connection lost");
    }
    return write(change);
  };
  const payload = {
    productId: "p1",
    changes: changes("customization_fields", [first, second], ["a", "b"]),
  };
  const partial = await saveProductPersonalization(payload, services);
  assert.equal(partial.succeeded, 1);
  assert.equal(partial.failed, 1);
  const refreshed = [
    store.get(key("customization_fields", "a")),
    store.get(key("customization_fields", "b")),
  ];
  const retried = await saveProductPersonalization(
    {
      productId: "p1",
      changes: changes("customization_fields", refreshed, ["a", "b"]),
    },
    services,
  );
  assert.equal(retried.failed, 0);
  assert.deepEqual(writes, ["a", "b"]);
});

test("revoked permission during a batch and unconfirmed write responses are failures", async () => {
  const first = row("a", ["box"]),
    second = row("b", ["p2"]);
  const { services, store } = fixture([
    ["customization_fields", first],
    ["customization_fields", second],
  ]);
  services.authorizeDefinition = async (_resource, id) => {
    if (
      id === "b" &&
      store.get(key("customization_fields", "a")).applies_to.includes("p1")
    )
      throw new Error("لم تعد تملك صلاحية التعديل.");
  };
  const result = await saveProductPersonalization(
    {
      productId: "p1",
      changes: changes("customization_fields", [first, second], ["a", "b"]),
    },
    services,
  );
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(store.get(key("customization_fields", "b")).applies_to, [
    "p2",
  ]);
  const unconfirmed = await saveProductPersonalization(
    {
      productId: "p1",
      changes: changes("customization_fields", [second], ["b"]),
    },
    {
      ...services,
      authorizeDefinition: async () => {},
      writeScope: async () => undefined,
    },
  );
  assert.equal(unconfirmed.succeeded, 0);
  assert.equal(unconfirmed.failed, 1);
});
