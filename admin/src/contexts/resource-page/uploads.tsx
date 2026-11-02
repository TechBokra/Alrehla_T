import { createContext, useContext, type ReactNode } from "react";
import type { ResourceUploadHandles } from "@/hooks/uploads";

const ResourceUploadsContext = createContext<ResourceUploadHandles | null>(null);

export function ResourceUploadsProvider({
  value,
  children,
}: {
  value: ResourceUploadHandles;
  children: ReactNode;
}) {
  return (
    <ResourceUploadsContext.Provider value={value}>
      {children}
    </ResourceUploadsContext.Provider>
  );
}

export function useResourceUploads() {
  const uploads = useContext(ResourceUploadsContext);
  if (!uploads) {
    throw new Error("Resource upload fields must be rendered inside a resource form page.");
  }
  return uploads;
}
