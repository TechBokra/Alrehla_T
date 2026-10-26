import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useOne } from "@refinedev/core";
import { useLocation } from "@tanstack/react-router";
import {
  siteBrandingQuery,
  siteBrandingValues,
  type BrandSettings,
  type SiteBrandingValues,
} from "./model";

type SiteBrandingContextValue = {
  branding: SiteBrandingValues;
  isLoading: boolean;
};
const SiteBrandingContext = createContext<SiteBrandingContextValue | null>(
  null,
);

export function SiteBrandingProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const options = siteBrandingQuery(pathname);
  // Starts alongside the layout's identity read, without waiting for its response.
  const { query, result } = useOne<BrandSettings>(options);
  const active = options.queryOptions.enabled;
  const branding = useMemo(
    () => siteBrandingValues(active ? result : undefined),
    [active, result],
  );
  const value = useMemo(
    () => ({ branding, isLoading: active && !result && query.isLoading }),
    [branding, active, result, query.isLoading],
  );

  useEffect(() => {
    if (!active || !branding.favicon) return;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = branding.favicon;
    document.head.appendChild(icon);
    return () => icon.remove();
  }, [active, branding.favicon]);

  return (
    <SiteBrandingContext.Provider value={value}>
      {children}
    </SiteBrandingContext.Provider>
  );
}

export function useSiteBranding() {
  const context = useContext(SiteBrandingContext);
  if (!context) throw new Error("SiteBranding requires SiteBrandingProvider");
  return context;
}
