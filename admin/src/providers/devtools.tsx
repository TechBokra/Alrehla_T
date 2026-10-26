import type { PropsWithChildren } from "react";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";

// Loaded only by Vite's development entry branch; covers all nested Refine contexts.
export default function DevelopmentTools({ children }: PropsWithChildren) {
  return (
    <DevtoolsProvider>
      {children}
      <DevtoolsPanel />
    </DevtoolsProvider>
  );
}
