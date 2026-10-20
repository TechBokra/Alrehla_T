"use client";

import { useId } from "react";
import { useFieldContext } from "../context";
import type { FieldProps } from "../types";

export type FieldPresentation = {
  field: any;
  id: string;
  label?: string;
  description?: string;
  disabled: boolean;
  accessibleLabel: string;
  invalid: boolean;
  errors: unknown[];
  errorId: string;
  descriptionId: string;
  describedBy?: string;
  labelId: string;
};

export function normalizeFieldErrors(errors: unknown[]) {
  return errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (error && typeof error === "object" && "message" in error) {
        return String(error.message ?? "");
      }
      return "";
    })
    .filter(Boolean)
    .map((message) => ({ message }));
}

export function useFieldPresentation({
  label,
  description,
  ariaLabel,
  disabled,
}: FieldProps): FieldPresentation {
  const field = useFieldContext<any>();
  const id = useId();
  const visibleLabel = label?.trim() || undefined;
  const accessibleLabel =
    visibleLabel || ariaLabel?.trim() || String(field.name);
  const errors = field.state.meta.errors as unknown[];
  const invalid = errors.length > 0;
  const errorId = id + "-error";
  const descriptionId = id + "-description";
  const describedBy =
    [description ? descriptionId : undefined, invalid ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return {
    field,
    id,
    label: visibleLabel,
    description,
    disabled: Boolean(disabled),
    accessibleLabel,
    invalid,
    errors,
    errorId,
    descriptionId,
    describedBy,
    labelId: id + "-label",
  };
}
