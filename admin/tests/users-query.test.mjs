import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../node_modules/typescript/lib/typescript.js";

const source = await readFile(new URL("../src/providers/refine/data-provider/users-query.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { buildUserListRequest } = await import(moduleUrl);

test("users list searches name and email and removes provider escaping", () => {
  assert.deepEqual(buildUserListRequest({
    filters: [{
      key: "__data_table_search",
      operator: "or",
      value: [
        { field: "full_name", operator: "contains", value: 'Ahmed \\"Ali\\"' },
        { field: "email", operator: "contains", value: 'Ahmed \\"Ali\\"' },
      ],
    }],
  }), {
    action: "list",
    search: 'Ahmed "Ali"',
    role: null,
    guardian: null,
    status: "not_archived",
    sort: "created_at",
    order: "desc",
    offset: 0,
    limit: 20,
  });
});

test("role, guardian, status, sorting and later-page pagination reach the server", () => {
  assert.deepEqual(buildUserListRequest({
    filters: [
      { field: "role", operator: "eq", value: { operator: "is", value: "publisher" } },
      { field: "is_guardian", operator: "eq", value: "false" },
      { field: "status", operator: "eq", value: "archived" },
    ],
    sorters: [{ field: "email", order: "asc" }],
    pagination: { currentPage: 3, pageSize: 20 },
  }), {
    action: "list",
    search: "",
    role: "publisher",
    guardian: false,
    status: "archived",
    sort: "email",
    order: "asc",
    offset: 40,
    limit: 20,
  });
});

test("page size is bounded by the RPC's supported maximum", () => {
  const request = buildUserListRequest({ pagination: { currentPage: 2, pageSize: 500 } });
  assert.equal(request.offset, 100);
  assert.equal(request.limit, 100);
});
