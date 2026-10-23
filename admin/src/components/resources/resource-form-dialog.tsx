import { createContext, useContext, useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { FormDialog } from "@/components/forms";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { closeDecision } from "./lifecycle";

const CloseContext = createContext<() => void>(() => {});
export function ResourceDialogCancel({ disabled }: { disabled: boolean }) {
  const close = useContext(CloseContext);
  return (
    <Button type="button" variant="outline" disabled={disabled} onClick={close}>
      إلغاء
    </Button>
  );
}

export function ResourceFormDialog({
  title,
  pending,
  dirty,
  onClose,
  children,
}: {
  title: string;
  pending: boolean;
  dirty: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: () => pending || dirty,
    enableBeforeUnload: pending || dirty,
    withResolver: true,
  });
  const navigationBlocked = blocker.status === "blocked";
  function close() {
    const decision = closeDecision(pending, dirty);
    if (decision === "confirm") setConfirm(true);
    if (decision === "close") onClose();
  }
  return (
    <>
      <FormDialog
        open
        title={title}
        description="راجع البيانات ثم اضغط حفظ."
        pending={pending}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
      </FormDialog>
      <AlertDialog
        open={confirm || navigationBlocked}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(false);
            if (navigationBlocked) blocker.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? "جارٍ الحفظ" : "تجاهل التغييرات؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? "انتظر حتى تنتهي عملية الحفظ."
                : "لديك تغييرات لم تُحفظ. هل تريد إغلاق النموذج؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>العودة للنموذج</AlertDialogCancel>
            {!pending && (
              <AlertDialogAction
                onClick={() => {
                  setConfirm(false);
                  if (navigationBlocked) blocker.proceed();
                  else onClose();
                }}
              >
                تجاهل التغييرات
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
