import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createSupabaseConnection, getSupabaseClient } from "../src/providers/supabase-client";
import { getSupabaseClient as authClient } from "../src/features/auth/supabase";
import { createAdminDataProvider, DataConfigurationError } from "../src/providers/data-provider";
import { previewDataProvider } from "../src/features/component-showcase/demo-provider";
import { createPrototypeDataProvider } from "../src/features/form-prototype/data-provider";

test("auth exports the canonical shared client getter", () => {
  assert.equal(authClient, getSupabaseClient);
});

test("connection reuses one typed client and exposes the REST endpoint", () => {
  const connection = createSupabaseConnection({ url: "https://example.supabase.co/", publishableKey: "sb_publishable_test" });
  assert.equal(connection.getClient(), connection.getClient());
  assert.equal(createAdminDataProvider(connection).getApiUrl(), "https://example.supabase.co/rest/v1");
});

test("missing configuration is harmless until data is requested and never returns an empty list", async () => {
  for (const configuration of [{}, { url: "https://example.supabase.co" }, { publishableKey: "key" }]) {
    const connection = createSupabaseConnection(configuration);
    const provider = createAdminDataProvider(connection);
    assert.equal(connection.getClient(), null);
    assert.throws(() => provider.getApiUrl(), DataConfigurationError);
    await assert.rejects(provider.getList({ resource: "user_profiles" }), DataConfigurationError);
    await assert.rejects(provider.create({ resource: "user_profiles", variables: {} }), DataConfigurationError);
    await assert.rejects(provider.deleteOne({ resource: "user_profiles", id: "1" }), DataConfigurationError);
  }
});

test("official provider propagates failed reads and uses the shared client's session", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push({ method: request.method, url: request.url, authorization: request.headers.get("authorization") });
    return new Response(JSON.stringify({ code: "42501", message: "permission denied", details: "", hint: "" }), {
      status: 403, headers: { "content-type": "application/json" },
    });
  };
  try {
    const connection = createSupabaseConnection({ url: "https://example.supabase.co", publishableKey: "sb_publishable_test" });
    const client = connection.getClient()!;
    let sessionReads = 0;
    const getSession = client.auth.getSession.bind(client.auth);
    client.auth.getSession = async () => { sessionReads++; return getSession(); };
    await assert.rejects(createAdminDataProvider(connection).getList({ resource: "user_profiles" }),
      (error: { message?: string }) => error.message === "permission denied");
    assert.ok(sessionReads > 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.match(calls[0].url, /\/rest\/v1\/user_profiles/);
    assert.equal(calls[0].authorization, "Bearer sb_publishable_test");
  } finally { globalThis.fetch = originalFetch; }
});

test("preview mutations stay local and nested contexts retain their own providers", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Demo must not use the network"); };
  try {
    const { data } = await previewDataProvider.create({ resource: "products", variables: { title: "Local only", sku: "LOCAL", price: 1, inventory: 1, status: "Draft" } });
    await previewDataProvider.update({ resource: "products", id: data.id!, variables: { title: "Edited locally" } });
    await previewDataProvider.deleteOne({ resource: "products", id: data.id! });
    const showcase = await readFile(new URL("../src/features/component-showcase/layout.tsx", import.meta.url), "utf8");
    const prototype = await readFile(new URL("../src/features/form-prototype/refine-demo.tsx", import.meta.url), "utf8");
    const root = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
    assert.match(showcase, /default:\s*previewDataProvider/);
    assert.match(prototype, /dataProvider=\{provider\}/);
    assert.match(root, /default:\s*adminDataProvider/);
  } finally { globalThis.fetch = originalFetch; }
});

test("form prototype create/edit/delete never contact staging", async () => {
  const originalFetch = globalThis.fetch;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = async () => { throw new Error("Prototype must not use the network"); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout } });
  try {
    const provider = createPrototypeDataProvider({ publish: () => {}, shouldFail: () => false });
    const { data } = await provider.create({ resource: "products", variables: { title: "Local", sku: "LOCAL", price: 1, inventory: 1, status: "draft" } });
    await provider.update({ resource: "products", id: data.id!, variables: { title: "Local edit" } });
    await provider.deleteOne({ resource: "products", id: data.id! });
  } finally {
    globalThis.fetch = originalFetch;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
