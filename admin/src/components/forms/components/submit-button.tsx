"use client";

import type { ReactNode } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminFormContext } from "../context";

export function SubmitButton({
  children = "Submit",
  disabled,
  formId,
}: {
  children?: ReactNode;
  disabled?: boolean;
  formId?: string;
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
        >
          {isSubmitting ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {isSubmitting ? "Saving…" : children}
        </Button>
      )}
    </form.Subscribe>
  );
}
