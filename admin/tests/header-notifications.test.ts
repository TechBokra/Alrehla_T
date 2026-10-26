import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  headerNotificationQueries,
  notificationBadge,
  notificationTime,
} from "../src/features/notifications/queries";
import { createAdminDataProvider } from "../src/providers/data-provider";
import { createSupabaseConnection } from "../src/providers/supabase-client";

test("both reads require an identity, poll every ten seconds, and do not poll hidden tabs", () => {
  for (const options of Object.values(headerNotificationQueries())) {
    assert.equal(options.queryOptions.enabled, false);
    assert.equal(options.queryOptions.refetchInterval, 10_000);
    assert.equal(options.queryOptions.refetchIntervalInBackground, false);
    assert.equal(options.queryOptions.retry, false);
    assert.equal(options.liveMode, "off");
    assert.equal(options.dataProviderName, "notifications");
    assert.equal(options.errorNotification, false);
    assert.equal(options.queryOptions.placeholderData, undefined);
  }
});

test("recipient isolation is included in both query keys and read filters", () => {
  const first = headerNotificationQueries("profile-a");
  const next = headerNotificationQueries("profile-b");
  for (const name of ["list", "unread"] as const) {
    assert.equal(first[name].queryOptions.enabled, true);
    assert.deepEqual(first[name].filters[0], {
      field: "recipient_profile_id",
      operator: "eq",
      value: "profile-a",
    });
    assert.notDeepEqual(first[name].filters, next[name].filters);
  }
  assert.deepEqual(first.list.pagination, {
    currentPage: 1,
    pageSize: 20,
    mode: "server",
  });
  assert.deepEqual(first.list.sorters, [
    { field: "created_at", order: "desc" },
    { field: "id", order: "desc" },
  ]);
  assert.deepEqual(first.unread.filters[1], {
    field: "is_read",
    operator: "eq",
    value: false,
  });
  assert.equal(first.unread.pagination.pageSize, 1);
  assert.equal(first.unread.meta.select, "id");
});

test("official provider uses GET only and returns the total unread count beyond the latest 20", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Request[] = [];
  const rows = Array.from({ length: 20 }, (_, index) => ({
    id: `notification-${index}`,
    title: "إشعار",
    message: null,
    is_read: false,
    created_at: "2026-10-26T10:00:00Z",
  }));
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request);
    const countOnly = new URL(request.url).searchParams.get("select") === "id";
    return new Response(
      JSON.stringify(countOnly ? [{ id: "notification-0" }] : rows),
      {
        headers: {
          "content-type": "application/json",
          "content-range": countOnly ? "0-0/143" : "0-19/180",
        },
      },
    );
  };
  try {
    const provider = createAdminDataProvider(
      createSupabaseConnection({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      }),
    );
    const queries = headerNotificationQueries("profile-a");
    const list = await provider.getList(queries.list);
    const unread = await provider.getList(queries.unread);
    assert.equal(list.data.length, 20);
    assert.equal(unread.total, 143);
    assert.equal(notificationBadge(unread.total), "99+");
    assert.equal(calls.length, 2);
    for (const request of calls) {
      assert.equal(request.method, "GET");
      assert.equal(
        new URL(request.url).searchParams.get("recipient_profile_id"),
        "eq.profile-a",
      );
    }
    assert.equal(new URL(calls[1].url).searchParams.get("is_read"), "eq.false");
    assert.match(calls[1].headers.get("prefer") ?? "", /count=exact/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("empty reads are successful zero totals; permission errors are rejected", async () => {
  const originalFetch = globalThis.fetch;
  let fail = false;
  globalThis.fetch = async () =>
    fail
      ? new Response(
          JSON.stringify({ code: "42501", message: "permission denied" }),
          { status: 403, headers: { "content-type": "application/json" } },
        )
      : new Response("[]", {
          headers: {
            "content-type": "application/json",
            "content-range": "*/0",
          },
        });
  try {
    const provider = createAdminDataProvider(
      createSupabaseConnection({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      }),
    );
    const query = headerNotificationQueries("profile-a").list;
    assert.deepEqual(await provider.getList(query), { data: [], total: 0 });
    fail = true;
    await assert.rejects(
      provider.getList(query),
      (error: { message?: string }) => error.message === "permission denied",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("query cache retains the last successful list and count after a failed refresh, then recovers", async () => {
  const require = createRequire(import.meta.url);
  const { QueryClient } = require(
    require.resolve("@tanstack/react-query", {
      paths: [require.resolve("@refinedev/core")],
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    for (const [kind, response] of [
      ["list", { data: [{ id: "notification-1" }], total: 1 }],
      ["unread", { data: [{ id: "notification-1" }], total: 143 }],
    ] as const) {
      const key = [
        "notifications",
        kind,
        headerNotificationQueries("profile-a")[kind].filters,
      ];
      await client.fetchQuery({ queryKey: key, queryFn: async () => response });
      await assert.rejects(
        client.fetchQuery({
          queryKey: key,
          queryFn: async () => {
            throw new Error("offline");
          },
        }),
      );
      assert.deepEqual(client.getQueryData(key), response);
      assert.equal(client.getQueryState(key).status, "error");
      await client.fetchQuery({ queryKey: key, queryFn: async () => response });
      assert.equal(client.getQueryState(key).status, "success");
      assert.equal(
        client.getQueryData([
          "notifications",
          kind,
          headerNotificationQueries("profile-b")[kind].filters,
        ]),
        undefined,
      );
    }
  } finally {
    client.clear();
  }
});

test("badge and timestamps distinguish unknown/zero, cap counts, and use Cairo time", () => {
  assert.equal(notificationBadge(undefined), undefined);
  assert.equal(notificationBadge(0), undefined);
  assert.equal(notificationBadge(4), "٤");
  assert.equal(notificationBadge(100), "99+");
  const date = "2026-10-26T10:00:00Z";
  assert.equal(
    notificationTime(date),
    new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date)),
  );
  assert.equal(notificationTime("invalid"), "وقت غير متاح");
});

test("root and showcase expose notifications through the live named provider, with demo defaults preserved", async () => {
  const read = (path: string) =>
    readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const root = await read("routes/__root.tsx");
  const showcase = await read("features/component-showcase/layout.tsx");
  assert.match(root, /default:\s*adminDataProvider/);
  assert.match(showcase, /default:\s*previewDataProvider/);
  for (const source of [root, showcase])
    assert.match(source, /notifications:\s*notificationsDataProvider/);
  assert.match(
    await read("features/form-prototype/refine-demo.tsx"),
    /dataProvider=\{provider\}/,
  );
  const popover = await read(
    "features/notifications/notifications-popover.tsx",
  );
  assert.doesNotMatch(popover, /useUpdate|useDelete|useCreate|href=/);
});
