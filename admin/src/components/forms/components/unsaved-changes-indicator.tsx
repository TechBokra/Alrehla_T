"use client";

import { useAdminFormContext } from "../context";

export function UnsavedChangesIndicator() {
  const form = useAdminFormContext();
  return (
    <form.Subscribe selector={(state: any) => state.isDirty}>
      {(isDirty: boolean) => (
        <span className="text-sm text-muted-foreground" role="status">
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
      )}
    </form.Subscribe>
  );
}
