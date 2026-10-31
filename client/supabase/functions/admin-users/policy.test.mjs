import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../../../../admin/node_modules/typescript/lib/typescript.js";

const source = await readFile(new URL("./policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const policy = await import(moduleUrl);

test("both active administrator roles can enter users without canManageUsers", () => {
  assert.equal(policy.isActiveUsersAdmin("general_supervisor", null), true);
  assert.equal(policy.isActiveUsersAdmin("super_admin", null), true);
  assert.equal(policy.isActiveUsersAdmin("customer", null), false);
  assert.equal(policy.isActiveUsersAdmin("super_admin", "2026-01-01T00:00:00Z"), false);
});

test("only super admins can assign or edit administrative roles", () => {
  assert.equal(policy.canAssignUserRole("general_supervisor", "customer"), true);
  assert.equal(policy.canAssignUserRole("general_supervisor", "super_admin"), false);
  assert.equal(policy.canChangeUserRole("general_supervisor", "general_supervisor", "customer"), false);
  assert.equal(policy.canChangeUserRole("super_admin", "super_admin", "customer"), true);
});

test("suspension blocks self, archived accounts, and administrative accounts", () => {
  assert.equal(policy.canSuspendUserAccount("a", "b", "customer", null), true);
  assert.equal(policy.canSuspendUserAccount("a", "a", "customer", null), false);
  assert.equal(policy.canSuspendUserAccount("a", "b", "super_admin", null), false);
  assert.equal(policy.canSuspendUserAccount("a", "b", "customer", "archived"), false);
});

test("deletion is super-admin only and excludes self, admins, children, and archives", () => {
  const base = {
    actorId: "admin",
    actorRole: "super_admin",
    targetId: "user",
    targetRole: "customer",
    isChildAccount: false,
    archivedAt: null,
  };
  assert.equal(policy.canDeleteUserAccount(base), true);
  assert.equal(policy.canDeleteUserAccount({ ...base, actorRole: "general_supervisor" }), false);
  assert.equal(policy.canDeleteUserAccount({ ...base, targetId: "admin" }), false);
  assert.equal(policy.canDeleteUserAccount({ ...base, targetRole: "general_supervisor" }), false);
  assert.equal(policy.canDeleteUserAccount({ ...base, isChildAccount: true }), false);
  assert.equal(policy.canDeleteUserAccount({ ...base, archivedAt: "archived" }), false);
});
