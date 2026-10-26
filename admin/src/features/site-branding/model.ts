export type BrandSettings = {
  id: string;
  siteName: string | null;
  logo: string | null;
  favicon: string | null;
};

export type SiteBrandingValues = {
  name: string;
  logo?: string;
  favicon?: string;
};

export function imageUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function siteBrandingValues(
  settings?: BrandSettings,
): SiteBrandingValues {
  return {
    name: settings?.siteName?.trim() || "الرحلة",
    logo: imageUrl(settings?.logo),
    favicon: imageUrl(settings?.favicon),
  };
}

/** Mounted beneath the root route's existing authentication guard. */
export function siteBrandingQuery(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return {
    resource: "site_settings",
    id: "general",
    dataProviderName: "siteSettings",
    meta: {
      idColumnName: "key",
      select:
        "id,siteName:value->>siteName,logo:value->images->>logo,favicon:value->images->>favicon",
    },
    queryOptions: {
      enabled: path !== "/sign-in" && path !== "/auth/callback",
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchInterval: false as const,
      refetchOnWindowFocus: false,
      retry: false as const,
    },
    errorNotification: false as const,
  };
}
