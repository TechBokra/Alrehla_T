import type { BaseRecord } from "@refinedev/core";
import { ResourceFormDialog } from "./resource-form-dialog";
import { useResourceContext } from "@/hooks/resources";
import type { ResourceFormDefinition } from "../../types";
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
      dataProviderName={form.dataProviderName}
      canEdit={form.canEdit}
      getErrorMessage={form.getErrorMessage}
      onSaved={form.onSaved}
      onClose={close}
    >
      {(context) =>
        form.fields({ ...context, resource, action: target.action })
      }
    </ResourceFormDialog>
  );
}
