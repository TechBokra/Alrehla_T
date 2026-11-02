import { useEffect, useMemo } from "react";
import { useOne } from "@refinedev/core";
import { siteBrandingQuery, siteBrandingValues, type BrandSettings } from "@/features/site-branding/model";

/** One Refine branding query, coordinated by AdminAccessProvider. */
export function useAdminBranding(options: Parameters<typeof siteBrandingQuery>[0]) {
  const { query, result } = useOne<BrandSettings>(siteBrandingQuery(options));
  const branding = useMemo(
    () => siteBrandingValues(options.enabled ? result : undefined),
    [options.enabled, result],
  );

  useEffect(() => {
    if (!options.enabled || !branding.favicon) return;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = branding.favicon;
    document.head.appendChild(icon);
    return () => icon.remove();
  }, [options.enabled, branding.favicon]);

  return { query, branding };
}
