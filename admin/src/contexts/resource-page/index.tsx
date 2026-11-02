import { createContext, useContext, type ReactNode } from "react";
import type { BaseRecord } from "@refinedev/core";
import type { ResourcePageRuntime } from "./types";

const ResourcePageContext = createContext<ResourcePageRuntime | null>(null);

export function ResourcePageContextProvider({
  value,
  children,
}: {
  value: ResourcePageRuntime;
  children: ReactNode;
}) {
  return (
    <ResourcePageContext.Provider value={value}>
      {children}
    </ResourcePageContext.Provider>
  );
}

export function useResourcePageContext<TRecord extends BaseRecord = BaseRecord>() {
  const value = useContext(ResourcePageContext);
  if (!value) throw new Error("useResourcePage must be used inside a resource page.");
  return value as ResourcePageRuntime<TRecord>;
}
