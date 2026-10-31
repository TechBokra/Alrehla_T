import type { BaseRecord } from "@refinedev/core";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useResourceDeleteCrud } from "@/hooks/resources/use-resource-delete-crud";

export function ResourceDeleteDialog<TRecord extends BaseRecord>({
  resource,
  id,
  name,
  canDelete,
  consequence,
  onClose,
}: {
  resource: string;
  id: string;
  name?: string;
  canDelete: boolean;
  consequence?: string;
  onClose: () => void;
}) {
  const deletion = useResourceDeleteCrud<TRecord>({ resource, id, canDelete });
  function remove() {
    void deletion.remove().then((deleted) => {
      if (deleted) onClose();
    });
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && deletion.canDismiss()) onClose();
      }}
    >
      <AlertDialogContent aria-busy={deletion.isPending}>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف السجل؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيُحذف «{name ?? id}» نهائيًا. {consequence}
            لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!canDelete && (
          <p role="alert" className="text-destructive">
            هذا السجل غير متاح للحذف هنا.
          </p>
        )}
        {deletion.error && (
          <p role="alert" className="text-destructive">
            {deletion.error.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deletion.isPending || !canDelete}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <Trash2 />
            {deletion.isPending ? "جارٍ الحذف…" : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
