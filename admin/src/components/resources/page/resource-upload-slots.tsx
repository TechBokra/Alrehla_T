import type { ReactNode } from "react";
import { ResourceUploadsProvider } from "@/contexts/resource-page/uploads";
import type { ResourceUploadDefinition, ResourceUploadHandles } from "@/hooks/uploads";
import { useResourceUploadSlot } from "@/hooks/resources/page/use-resource-upload-slot";

export function ResourceUploadSlots({
  definitions,
  children,
}: {
  definitions: Record<string, ResourceUploadDefinition>;
  children: ReactNode;
}) {
  const entries = Object.entries(definitions);
  return (
    <ResourceUploadSlotChain entries={entries} index={0} handles={{}}>
      {children}
    </ResourceUploadSlotChain>
  );
}

function ResourceUploadSlotChain({
  entries,
  index,
  handles,
  children,
}: {
  entries: [string, ResourceUploadDefinition][];
  index: number;
  handles: ResourceUploadHandles;
  children: ReactNode;
}) {
  if (index >= entries.length) {
    return (
      <ResourceUploadsProvider value={handles}>{children}</ResourceUploadsProvider>
    );
  }
  const [name, definition] = entries[index];
  return (
    <ResourceUploadSlot key={name} definition={definition}>
      {(handle) => (
        <ResourceUploadSlotChain
          entries={entries}
          index={index + 1}
          handles={{ ...handles, [name]: handle }}
        >
          {children}
        </ResourceUploadSlotChain>
      )}
    </ResourceUploadSlot>
  );
}

function ResourceUploadSlot({
  definition,
  children,
}: {
  definition: ResourceUploadDefinition;
  children: (handle: ReturnType<typeof useResourceUploadSlot>) => ReactNode;
}) {
  const handle = useResourceUploadSlot(definition);
  return children(handle);
}
