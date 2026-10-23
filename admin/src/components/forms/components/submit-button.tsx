"use client";

import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminFormContext } from "../context";

export function SubmitButton({
  children = "حفظ",
  disabled,
  formId,
  pendingLabel = "جارٍ الحفظ…",
  icon = <Save data-icon="inline-start" />,
  className,
  size,
}: {
  children?: ReactNode;
  disabled?: boolean;
  formId?: string;
  pendingLabel?: string;
  icon?: ReactNode;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
}) {
  const form = useAdminFormContext();
  return (
    <form.Subscribe selector={(state: any) => state.isSubmitting}>
      {(isSubmitting: boolean) => (
        <Button
          type="submit"
          form={formId}
          disabled={disabled || isSubmitting}
          aria-busy={isSubmitting}
          className={className}
          size={size}
        >
          {isSubmitting ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            icon
          )}
          {isSubmitting ? pendingLabel : children}
        </Button>
      )}
    </form.Subscribe>
  );
}
