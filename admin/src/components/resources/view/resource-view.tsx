import type { BaseRecord } from "@refinedev/core";
import { ResourceAccessGate } from "../access/resource-access-gate";
import { ResourceContextProvider } from "@/contexts/resource";
import { useResourceController } from "@/hooks/resources";
import { ResourcePage } from "./resource-page";
import { ResourceDialogs } from "../dialogs/resource-dialogs";
import { resourceFormRegistry } from "../forms/registry";
import type { ResourceViewProps } from "../types";

type ResourceRecord = BaseRecord & { id: string | number };

/** Shared resource screen; data and permission logic live in resource hooks. */
export function ResourceView<TRecord extends ResourceRecord>(
  props: ResourceViewProps<TRecord>,
) {
  return (
    <ResourceAccessGate key={props.resource} resource={props.resource}>
      <AuthorizedResourceView {...props} />
    </ResourceAccessGate>
  );
}
function AuthorizedResourceView<TRecord extends ResourceRecord>(
  props: ResourceViewProps<TRecord>,
) {
  const { table, reorder, scope, canCreate, canSort } = useResourceController(props);
  const DialogEditor = resourceFormRegistry.dialog.Editor;
  return (
    <ResourceContextProvider value={scope}>
      <ResourcePage
        title={props.title}
        description={props.description ?? ""}
        table={table}
        pageSizeOptions={props.pageSizeOptions}
        toolbarContent={props.toolbarContent?.(table)}
        createAction={props.createAction}
        canCreate={canCreate}
        storageKey={props.storageKey ?? `live-${props.resource}`}
        rowReordering={
          canSort ? {
            getRowLabel: props.getRowLabel ?? ((row) => String(row.name ?? row.id)),
            onReorder: reorder,
          } : undefined
        }
      >
        <ResourceDialogs>
          <DialogEditor form={props.form} />
        </ResourceDialogs>
        {props.children}
      </ResourcePage>
    </ResourceContextProvider>
  );
}
