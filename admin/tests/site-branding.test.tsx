import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBrandingDisplay } from "../src/components/site-branding";
import {
  siteBrandingQuery,
  siteBrandingValues,
} from "../src/features/site-branding/model";

test("branding starts on protected routes without waiting for identity", () => {
  for (const path of ["/", "/catalog/products", "/theme"]) {
    const options = siteBrandingQuery(path);
    assert.equal(options.queryOptions.enabled, true);
    assert.equal(options.dataProviderName, "siteSettings");
    assert.equal(options.meta.idColumnName, "key");
    assert.equal(options.id, "general");
  }
  for (const path of [
    "/sign-in",
    "/sign-in/",
    "/auth/callback",
    "/auth/callback/",
  ]) {
    assert.equal(siteBrandingQuery(path).queryOptions.enabled, false);
  }
});

test("branding cache is shared, fresh for five minutes and retained for thirty", async () => {
  const options = siteBrandingQuery("/catalog/products").queryOptions;
  assert.equal(options.staleTime, 300_000);
  assert.equal(options.gcTime, 1_800_000);
  assert.equal(options.refetchInterval, false);
  assert.equal(options.refetchOnWindowFocus, false);
  const require = createRequire(import.meta.url);
  const { QueryClient } = require(
    require.resolve("@tanstack/react-query", {
      paths: [require.resolve("@refinedev/core")],
    }),
  );
  const client = new QueryClient();
  let calls = 0;
  const query = {
    ...options,
    queryKey: ["siteSettings", "site_settings", "general"],
    queryFn: async () => {
      calls++;
      return { siteName: "الرحلة" };
    },
  };
  try {
    await client.fetchQuery(query);
    await client.fetchQuery(query);
    assert.equal(calls, 1);
    assert.equal(client.getQueryData(query.queryKey).siteName, "الرحلة");
  } finally {
    client.clear();
  }
});

test("empty and invalid fields use fallbacks without indefinite skeletons", () => {
  assert.deepEqual(siteBrandingValues(), {
    name: "الرحلة",
    logo: undefined,
    favicon: undefined,
  });
  const branding = siteBrandingValues({
    id: "general",
    siteName: " ",
    logo: "javascript:bad",
    favicon: "",
  });
  assert.deepEqual(branding, siteBrandingValues());
  for (const collapsed of [true, false]) {
    const html = renderToStaticMarkup(
      <SiteBrandingDisplay
        branding={branding}
        isLoading={false}
        collapsed={collapsed}
      />,
    );
    assert.doesNotMatch(html, /data-slot="skeleton"/);
    if (!collapsed) assert.match(html, /الرحلة/);
  }
});

test("expanded sidebar renders only logo; collapsed sidebar omits logo", () => {
  const branding = {
    name: "الرحلة",
    logo: "https://example.com/logo.png",
    favicon: "https://example.com/favicon.png",
  };
  const expanded = renderToStaticMarkup(
    <SiteBrandingDisplay
      branding={branding}
      isLoading={false}
      collapsed={false}
    />,
  );
  assert.match(expanded, /alt="شعار الرحلة"/);
  assert.doesNotMatch(expanded, /alt="أيقونة الموقع"/);
  const collapsed = renderToStaticMarkup(
    <SiteBrandingDisplay branding={branding} isLoading={false} collapsed />,
  );
  assert.doesNotMatch(collapsed, /alt="شعار الرحلة"/);
  assert.match(collapsed, /data-slot="avatar"/);
  const loading = renderToStaticMarkup(
    <SiteBrandingDisplay branding={branding} isLoading collapsed={false} />,
  );
  assert.match(loading, /جارٍ تحميل هوية الموقع/);
  assert.match(loading, /h-8 w-full/);
});

test("root owns branding above nested showcase Refine and does not depend on identity", async () => {
  const root = await readFile(
    new URL("../src/routes/__root.tsx", import.meta.url),
    "utf8",
  );
  const showcase = await readFile(
    new URL("../src/features/component-showcase/layout.tsx", import.meta.url),
    "utf8",
  );
  const provider = await readFile(
    new URL("../src/features/site-branding/provider.tsx", import.meta.url),
    "utf8",
  );
  assert.match(root, /<SiteBrandingProvider>\s*<Outlet/);
  assert.match(root, /siteSettings: adminDataProvider/);
  assert.doesNotMatch(showcase, /siteSettings:/);
  assert.match(showcase, /default: previewDataProvider/);
  assert.doesNotMatch(provider, /useGetIdentity|localStorage/);
});
