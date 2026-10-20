"use client";

import * as React from "react";
import { cn } from "cn";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type FormSheetProps = {
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

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  pending = false,
  className,
  bodyClassName,
}: FormSheetProps) {
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl",
          className
        )}
        showCloseButton={!pending}
        onEscapeKeyDown={preventPendingClose}
        onInteractOutside={preventPendingClose}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 py-5",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <SheetFooter className="shrink-0 border-t bg-background px-6 py-4">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
