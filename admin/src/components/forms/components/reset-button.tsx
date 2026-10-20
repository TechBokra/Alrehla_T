"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminFormContext } from "../context";

export function ResetButton({
  children = "Reset",
  disabled,
  onReset,
}: {
  children?: ReactNode;
  disabled?: boolean;
  onReset?: () => void;
}) {
  const form = useAdminFormContext();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => {
        form.reset();
        onReset?.();
      }}
    >
      <RotateCcw data-icon="inline-start" />
      {children}
    </Button>
  );
}
