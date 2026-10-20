"use client";

import * as React from "react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  pending?: boolean;
  className?: string;
  bodyClassName?: string;
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  pending = false,
  className,
  bodyClassName,
}: FormDialogProps) {
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && pending) return;
      onOpenChange(nextOpen);
    },
    [onOpenChange, pending]
  );
  const preventPendingClose = React.useCallback(
    (event: { preventDefault: () => void }) => {
      if (pending) event.preventDefault();
    },
    [pending]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90dvh,56rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          className
        )}
        showCloseButton={!pending}
        onEscapeKeyDown={preventPendingClose}
        onInteractOutside={preventPendingClose}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div
          data-form-dialog-body=""
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 py-5",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
