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

/** Start alongside permissions once the shared session has verified an admin. */
export function siteBrandingQuery({ enabled, version, profileId }: {
  enabled: boolean;
  version: number;
  profileId?: string;
}) {
  return {
    resource: "site_settings",
    id: "general",
    dataProviderName: "siteSettings",
    meta: {
      idColumnName: "key",
      authVersion: version,
      identity: profileId,
      select:
        "id,siteName:value->>siteName,logo:value->images->>logo,favicon:value->images->>favicon",
    },
    queryOptions: {
      enabled,
      staleTime: 5 * 60_000,
      gcTime: 0,
      refetchInterval: false as const,
      refetchOnWindowFocus: false,
      retry: false as const,
    },
    errorNotification: false as const,
  };
}
