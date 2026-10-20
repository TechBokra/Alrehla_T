"use client";

import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import {
  normalizeFieldErrors,
  type FieldPresentation,
} from "../hooks/use-field-presentation";
import { FieldHeader } from "./field-header";
import { FieldHelp } from "./field-help";

export function FieldFrame({
  presentation,
  children,
  labelTarget = "htmlFor",
  className,
}: {
  presentation: FieldPresentation;
  children: ReactNode;
  labelTarget?: "htmlFor" | "labelledBy";
  className?: string;
}) {
  const {
    label,
    description,
    accessibleLabel,
    invalid,
    errors,
    errorId,
    descriptionId,
    disabled,
  } = presentation;

  return (
    <Field
      data-invalid={invalid}
      data-disabled={disabled}
      aria-label={!label ? accessibleLabel : undefined}
      aria-labelledby={label ? presentation.labelId : undefined}
      aria-describedby={presentation.describedBy}
      className={className}
    >
      <FieldHeader presentation={presentation} labelTarget={labelTarget} />
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
    </Field>
  );
}
