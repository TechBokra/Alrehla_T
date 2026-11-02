import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogSettingsDataProvider } from "../src/providers/refine/data-provider/catalog-settings-adapter.ts";

function fixture(overrides = {}) {
  const calls = [];
  const base = {
    getList: async (params) => {
      calls.push(["list", params]);
      return { data: [], total: 0 };
    },
    getOne: async (params) => {
      calls.push(["one", params]);
      return { data: { id: params.id } };
    },
    getMany: async (params) => {
      calls.push(["many", params]);
      return { data: [] };
    },
    create: async (params) => {
      calls.push(["create", params]);
      return {
        data: { id: params.variables.code ?? "saved", ...params.variables },
      };
    },
    update: async (params) => {
      calls.push(["update", params]);
      return { data: { id: params.id, ...params.variables } };
    },
    deleteOne: async () => {
      throw new Error("must not delete");
    },
    ...overrides,
  };
  const authorize = async (...params) => {
    calls.push(["authorize", ...params]);
  };
  return {
    calls,
    provider: createCatalogSettingsDataProvider(base, authorize),
  };
}

test("create and edit forms can omit order without resetting a stored position", async () => {
  const { provider, calls } = fixture();
  await provider.create({
    resource: "story_goals",
    variables: { label: "حب القراءة", is_active: true, applies_to: null },
  });
  await provider.create({
    resource: "writing_dialects",
    variables: { code: "egyptian", name_ar: "المصرية", is_active: true },
  });
  await provider.update({ resource: "story_goals", id: "goal", variables: { label: "الثقة بالنفس" } });
  for (const [, params] of calls.filter(([name]) => name === "create" || name === "update")) {
    assert.equal(Object.hasOwn(params.variables, "sort_order"), false);
  }
});

test("dialect identity uses its existing code for detail, selected rows, mutations and stable ordering", async () => {
  const { provider, calls } = fixture();
  await provider.getList({
    resource: "writing_dialects",
    sorters: [
      { field: "sort_order", order: "asc" },
      { field: "id", order: "asc" },
    ],
  });
  await provider.getOne({ resource: "writing_dialects", id: "egyptian" });
  await provider.getMany({ resource: "writing_dialects", ids: ["egyptian"] });
  await provider.update({
    resource: "writing_dialects",
    id: "egyptian",
    variables: { name_ar: "المصرية", is_active: false },
  });
  for (const [, params] of calls.filter(([name]) => name !== "authorize")) {
    assert.equal(params.meta.idColumnName, "code");
    assert.equal(
      params.meta.select,
      "id:code,code,name_ar,is_active,sort_order",
    );
  }
  assert.deepEqual(calls[0][1].sorters, [
    { field: "sort_order", order: "asc" },
    { field: "code", order: "asc" },
  ]);
  assert.deepEqual(
    calls.find(([name]) => name === "authorize"),
    ["authorize", "writing_dialects", "edit", "egyptian"],
  );
});

test("dialect edits cannot change the primary key or write unrelated fields", async () => {
  for (const variables of [
    { code: "new_code" },
    { id: "another_id" },
    { name_ar: "اسم", secret: true },
  ]) {
    const { provider, calls } = fixture();
    await assert.rejects(
      provider.update({
        resource: "writing_dialects",
        id: "egyptian",
        variables,
      }),
    );
    assert.equal(
      calls.some(([name]) => name === "update"),
      false,
    );
  }
});

test("empty restricted scopes cannot silently become global; explicit null preserves global scope", async () => {
  const { provider, calls } = fixture();
  await assert.rejects(
    provider.update({
      resource: "story_goals",
      id: "goal",
      variables: { applies_to: [] },
    }),
  );
  await provider.update({
    resource: "story_goals",
    id: "goal",
    variables: { applies_to: null },
  });
  assert.deepEqual(
    calls
      .filter(([name]) => name === "update")
      .map(([, params]) => params.variables),
    [{ applies_to: null }],
  );
  await provider.update({
    resource: "customization_fields",
    id: "field",
    variables: { applies_to: ["product", "box"] },
  });
  assert.deepEqual(calls.at(-1)[1].variables.applies_to, ["product", "box"]);
});

test("saved ordering changes only the rank and preserves existing signed integer positions", async () => {
  const { provider, calls } = fixture();
  await provider.update({
    resource: "customization_fields",
    id: "field",
    variables: { sort_order: -10 },
  });
  assert.deepEqual(calls.at(-1)[1].variables, { sort_order: -10 });
  await assert.rejects(
    provider.update({
      resource: "story_goals",
      id: "goal",
      variables: { sort_order: 1.5 },
    }),
  );
});

test("creation caps include inactive definitions and abort before creating another record", async () => {
  for (const [resource, total, variables] of [
    [
      "customization_fields",
      15,
      {
        label: "اهتمام الطفل",
        placeholder: null,
        is_required: false,
        is_active: true,
        sort_order: 0,
        applies_to: null,
      },
    ],
    [
      "story_goals",
      30,
      {
        label: "الثقة بالنفس",
        is_active: true,
        sort_order: 0,
        applies_to: null,
      },
    ],
  ]) {
    let created = false;
    const { provider } = fixture({
      getList: async () => ({ data: [], total }),
      create: async () => {
        created = true;
        return { data: { id: "unexpected" } };
      },
    });
    await assert.rejects(provider.create({ resource, variables }), /الأقصى/);
    assert.equal(created, false);
  }
});

test("unconfirmed writes and unavailable operations fail instead of reporting success", async () => {
  const { provider } = fixture({ update: async () => ({ data: undefined }) });
  await assert.rejects(
    provider.update({
      resource: "story_goals",
      id: "gone",
      variables: { is_active: false },
    }),
    /السجل غير موجود/,
  );
  await assert.rejects(provider.getOne({ resource: "orders", id: "order" }));
  await assert.rejects(
    provider.deleteOne({ resource: "writing_dialects", id: "egyptian" }),
  );
});
