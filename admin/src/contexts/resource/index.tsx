import { createContext, type ReactNode } from "react";
import type { ResourceContextValue } from "./types";

export const ResourceContext = createContext<ResourceContextValue | null>(null);

/** Thin page-scoped context boundary; state and behavior live in resource hooks. */
export function ResourceContextProvider({
  value,
  children,
}: {
  value: ResourceContextValue;
  children: ReactNode;
}) {
  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
}
