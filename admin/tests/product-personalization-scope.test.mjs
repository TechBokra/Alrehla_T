import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeSelectionIntent,
  planProductScopeChanges,
  scopeAppliesToProduct,
  selectedProductIds,
} from "../src/features/catalog/products/form-page/personalization-scope.ts";

const row = (id, applies_to, updated_at = "2026-11-02T00:00:00.000Z") => ({
  id,
  label: id,
  applies_to,
  updated_at,
  is_active: true,
  sort_order: 1,
});

test("global definitions are inherited and never enter the restricted selection", () => {
  const definitions = [
    row("global", null),
    row("restricted", ["other", "box"]),
    row("selected", ["p1"]),
  ];
  assert.equal(scopeAppliesToProduct(definitions[0], "p1"), true);
  assert.deepEqual(selectedProductIds(definitions, "p1"), ["selected"]);
  assert.deepEqual(
    planProductScopeChanges(definitions, "p1", ["selected"]),
    [],
  );
});

test("adding and removing product preserves box and other product scopes", () => {
  const defs = [row("add", ["box", "p2"]), row("remove", ["box", "p1", "p3"])];
  assert.deepEqual(
    planProductScopeChanges(defs, "p1", ["add"]).map((change) => [
      change.id,
      change.appliesTo,
    ]),
    [
      ["add", ["box", "p2", "p1"]],
      ["remove", ["box", "p3"]],
    ],
  );
});

test("last target cannot be removed and target cap is enforced", () => {
  assert.throws(
    () => planProductScopeChanges([row("only", ["p1"])], "p1", []),
    /مخصصة لهذا المنتج وحده/,
  );
  const full = Array.from({ length: 100 }, (_, i) => `p${i}`);
  assert.throws(
    () => planProductScopeChanges([row("full", full)], "new", ["full"]),
    /١٠٠/,
  );
});

test("unknown and inherited IDs cannot be submitted as restricted selections", () => {
  const definitions = [row("global", null), row("restricted", ["other"])];
  assert.throws(
    () => planProductScopeChanges(definitions, "p1", ["missing"]),
    /غير معروف/,
  );
  assert.throws(
    () => planProductScopeChanges(definitions, "p1", ["global"]),
    /غير معروف/,
  );
});

test("stale timestamps are carried into the conditional write plan", () => {
  const change = planProductScopeChanges([row("f", ["other"])], "p1", ["f"])[0];
  assert.equal(change.expectedUpdatedAt, "2026-11-02T00:00:00.000Z");
  assert.deepEqual(change.expectedAppliesTo, ["other"]);
  assert.deepEqual(change.appliesTo, ["other", "p1"]);
});

test("legacy empty scopes require an explicit repair in catalog settings", () => {
  assert.throws(
    () => planProductScopeChanges([row("broken", [])], "p1", ["broken"]),
    /أصلحه من إعدادات الكتالوج/,
  );
  assert.deepEqual(planProductScopeChanges([row("broken", [])], "p1", []), []);
});

test("retry planning from reconciled server rows writes only the remaining selection", () => {
  const requested = ["a", "b"];
  const afterPartialSave = [
    row("a", ["p1"]),
    row("b", ["other"], "2026-11-02T00:01:00.000Z"),
  ];
  assert.deepEqual(
    planProductScopeChanges(afterPartialSave, "p1", requested).map(
      (item) => item.id,
    ),
    ["b"],
  );
});

test("reconciliation preserves only explicit selection intent over fresh memberships", () => {
  const merged = mergeSelectionIntent(
    ["external-add", "save-succeeded"],
    ["remove"],
    ["add", "save-succeeded"],
    ["external-add", "remove", "add", "save-succeeded"],
  );
  assert.deepEqual(
    new Set(merged.selected),
    new Set(["external-add", "add", "save-succeeded"]),
  );
});

test("reconciliation reports requested definitions deleted or made global", () => {
  assert.deepEqual(mergeSelectionIntent([], [], ["gone"], []), {
    selected: [],
    unavailable: ["gone"],
  });
});
