"use client";

import { FieldLabel, FieldTitle } from "@/components/ui/field";
import { FieldHelp } from "./field-help";
import type { FieldPresentation } from "../hooks/use-field-presentation";

export function FieldHeader({
  presentation,
  labelTarget = "htmlFor",
}: {
  presentation: FieldPresentation;
  labelTarget?: "htmlFor" | "labelledBy";
}) {
  const { label, description, accessibleLabel, id, labelId } = presentation;
  if (!label) return null;

  return (
    <div className="flex items-center gap-1.5">
      {labelTarget === "htmlFor" ? (
        <FieldLabel id={labelId} htmlFor={id}>
          {label}
        </FieldLabel>
      ) : (
        <FieldTitle id={labelId}>{label}</FieldTitle>
      )}
      {description ? (
        <FieldHelp description={description} label={accessibleLabel} />
      ) : null}
    </div>
  );
}
