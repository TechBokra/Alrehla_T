import { useBlocker } from "@tanstack/react-router";
import { useFormContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function ResourceFormDirtyGuard() {
  const form = useFormContext();
  const blocker = useBlocker({
    withResolver: true,
    // Read TanStack Form's current store at navigation time. This sees an
    // immediate form.reset() before React has committed the next render.
    shouldBlockFn: () => form.state.isDirty,
    enableBeforeUnload: () => form.state.isDirty,
  });
  const blocked = blocker.status === "blocked";
  return (
    <AlertDialog
      open={blocked}
      onOpenChange={(open) => {
        if (!open && blocker.status === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تغييرات غير محفوظة</AlertDialogTitle>
          <AlertDialogDescription>
            لديك تغييرات لم تُحفظ. هل تريد مغادرة الصفحة وفقدانها؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>البقاء في الصفحة</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              if (blocker.status === "blocked") blocker.proceed();
            }}
          >
            مغادرة الصفحة
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
