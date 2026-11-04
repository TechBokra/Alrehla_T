import type { BaseRecord } from "@refinedev/core";
import { ResourceFormDialog } from "./resource-form-dialog";
import { useResourceContext } from "@/hooks/resources";
import type { ResourceFormFactory } from "../../page/types";
import { ResourceUploadSlots } from "../../page/resource-upload-slots";

export function ResourceEditor<TRecord extends BaseRecord>({
  form,
  canEdit,
}: {
  form: ResourceFormFactory<TRecord>;
  canEdit?: (record: TRecord) => boolean;
}) {
  const { resource, target, close } = useResourceContext();
  const dialog = form.kind === "form" ? form.dialog : undefined;
  if (!target || target.action === "delete" || !dialog) return null;
  return (
    <ResourceUploadSlots definitions={dialog.uploads ?? {}}>
      <ResourceFormDialog<TRecord>
        resource={resource}
        id={target.action === "edit" ? target.id : undefined}
        title={`${target.action === "edit" ? "تعديل" : "إضافة"} ${dialog.title}`}
        dataProviderName={form.dataProviderName}
        canEdit={canEdit ?? dialog.canEdit}
        getErrorMessage={dialog.getErrorMessage}
        onSaved={dialog.onSaved}
        onClose={close}
      >
        {(context) =>
          dialog.fields({ ...context, resource, action: target.action })
        }
      </ResourceFormDialog>
    </ResourceUploadSlots>
  );
}
