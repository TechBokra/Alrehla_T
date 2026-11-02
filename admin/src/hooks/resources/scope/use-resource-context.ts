import { useContext } from "react";
import { ResourceContext } from "@/contexts/resource";

export function useResourceContext() {
  const context = useContext(ResourceContext);
  if (!context)
    throw new Error("Resource components must be inside ResourceContextProvider.");
  return context;
}
