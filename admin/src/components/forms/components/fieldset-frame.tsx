"use client";

import type { ReactNode } from "react";
import {
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  normalizeFieldErrors,
  type FieldPresentation,
} from "../hooks/use-field-presentation";
import { FieldHelp } from "./field-help";

export function FieldsetFrame({
  presentation,
  children,
}: {
  presentation: FieldPresentation;
  children: ReactNode;
}) {
  const {
    label,
    description,
    accessibleLabel,
    invalid,
    errors,
    errorId,
    descriptionId,
    describedBy,
    labelId,
    disabled,
  } = presentation;

  return (
    <FieldSet
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      data-invalid={invalid}
      data-disabled={disabled}
    >
      <FieldLegend
        variant="label"
        className={!label ? "sr-only" : "flex items-center gap-1.5"}
      >
        <span id={labelId}>{label || accessibleLabel}</span>
        {label && description ? (
          <FieldHelp description={description} label={accessibleLabel} />
        ) : null}
      </FieldLegend>
      {description ? (
        <FieldDescription id={descriptionId} className="sr-only">
          {description}
        </FieldDescription>
      ) : null}
      {children}
      {!label && description ? (
        <div className="flex items-center">
          <FieldHelp description={description} label={accessibleLabel} />
        </div>
      ) : null}
      <FieldError
        id={invalid ? errorId : undefined}
        errors={normalizeFieldErrors(errors)}
      />
    </FieldSet>
  );
}
