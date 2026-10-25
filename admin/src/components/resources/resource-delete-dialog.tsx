import { useRef, useState } from "react";
import {
  useDelete,
  useInvalidate,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { refreshSavedResource } from "./lifecycle";

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
  const deletion = useDelete<TRecord, HttpError>({
    mutationOptions: { retry: false },
  });
  const invalidate = useInvalidate();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (inFlight.current || !canDelete) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await deletion.mutateAsync({
        resource,
        id,
        mutationMode: "pessimistic",
        invalidates: [],
        successNotification: false,
        errorNotification: false,
      });
    } catch (failure) {
      const code = (failure as { code?: string })?.code;
      const status = (failure as { statusCode?: number })?.statusCode;
      setError(
        code === "42501" || status === 401 || status === 403
          ? "ليس لديك صلاحية لحذف هذا السجل."
          : code === "23503"
            ? "السجل مرتبط ببيانات أخرى ولا يمكن حذفه."
            : "تعذّر حذف السجل. حاول مرة أخرى.",
      );
      inFlight.current = false;
      setPending(false);
      return;
    }
    const refreshed = await refreshSavedResource(() =>
      invalidate({ resource, id, invalidates: ["list", "many", "detail"] }),
    );
    toast.success("تم حذف السجل", {
      description: refreshed ? undefined : "حدّث القائمة لعرض آخر البيانات.",
    });
    onClose();
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !inFlight.current) onClose();
      }}
    >
      <AlertDialogContent aria-busy={pending}>
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
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || !canDelete}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <Trash2 />
            {pending ? "جارٍ الحذف…" : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
