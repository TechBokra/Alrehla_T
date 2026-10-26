import type { ReactNode } from "react";
import type { BaseRecord } from "@refinedev/core";
import {
  ResourceFormDialog,
  type ResourceFormDialogContext,
} from "./resource-form-dialog";
import { useResourceContext } from "./resource-context";

export interface ResourceFormFieldsContext<
  TRecord,
> extends ResourceFormDialogContext<TRecord> {
  resource: string;
  action: "create" | "edit";
}
export interface ResourceFormDefinition<TRecord extends BaseRecord> {
  title: string;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  fields: (context: ResourceFormFieldsContext<TRecord>) => ReactNode;
}
export function ResourceEditor<TRecord extends BaseRecord>({
  form,
}: {
  form: ResourceFormDefinition<TRecord>;
}) {
  const { resource, target, close } = useResourceContext();
  if (!target || target.action === "delete") return null;
  return (
    <ResourceFormDialog<TRecord>
      resource={resource}
      id={target.action === "edit" ? target.id : undefined}
      title={`${target.action === "edit" ? "تعديل" : "إضافة"} ${form.title}`}
      canEdit={form.canEdit}
      getErrorMessage={form.getErrorMessage}
      onClose={close}
    >
      {(context) =>
        form.fields({ ...context, resource, action: target.action })
      }
    </ResourceFormDialog>
  );
}
