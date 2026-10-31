import { Fragment, type ReactNode } from "react";
import { useResourceContext } from "./resource-context";
import { ResourceDeleteDialog } from "./resource-delete-dialog";

/** Mounts one dialog for the currently selected action. */
export function ResourceDialogs({ children }: { children: ReactNode }) {
  const {
    resource,
    target,
    selectedRow,
    canDeleteSelected,
    deleteConsequence,
    close,
  } = useResourceContext();
  if (!target) return null;
  if (target.action === "delete")
    return (
      <ResourceDeleteDialog
        key={target.key}
        resource={resource}
        id={target.id}
        name={selectedRow?.name ? String(selectedRow.name) : undefined}
        canDelete={canDeleteSelected}
        record={selectedRow}
        consequence={deleteConsequence}
        onClose={close}
      />
    );
  return <Fragment key={target.key}>{children}</Fragment>;
}
