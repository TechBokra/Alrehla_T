"use client";

import { useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { fieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { normalizeFieldErrors } from "@/lib/form-errors";
import type { FieldProps, FormFieldPresentationProps } from "../types";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { FormFieldHelp } from "./field-help";

export interface FormFieldLabelProps extends FormFieldPresentationProps {
  htmlFor?: string;
  id?: string;
  labelTarget?: "htmlFor" | "labelledBy";
  ariaLabel?: string;
}

export function FormFieldLabel({
  label,
  description,
  required,
  htmlFor,
  id,
  labelClassName,
  labelTarget = "htmlFor",
  ariaLabel,
}: FormFieldLabelProps) {
  if (!label) return null;
  const content = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      ) : null}
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {labelTarget === "htmlFor" ? (
        <FieldLabel id={id} htmlFor={htmlFor} className={labelClassName}>
          {content}
        </FieldLabel>
      ) : (
        <FieldTitle id={id} className={labelClassName}>
          {content}
        </FieldTitle>
      )}
      <FormFieldHelp label={ariaLabel ?? label} description={description} />
    </div>
  );
}

export type BaseFormFieldControlProps = {
  id: string;
  disabled: boolean;
  required: boolean;
  "aria-invalid": boolean;
  "aria-required": boolean | undefined;
  "aria-describedby": string | undefined;
  "aria-labelledby": string | undefined;
  "aria-label": string | undefined;
};

export interface BaseFormFieldProps extends FieldProps {
  fieldProps?: ComponentProps<typeof Field>;
  children: ReactNode | ((props: BaseFormFieldControlProps) => ReactNode);
  error?: ReactNode;
  invalid?: boolean;
  htmlFor?: string;
  labelTarget?: "htmlFor" | "labelledBy";
  variant?: "field" | "fieldset";
  orientation?: "vertical" | "horizontal";
  controlPosition?: "start" | "end";
}

/** Shared presentation only; the form and child control retain their own state. */
export function BaseFormField({
  children,
  fieldProps,
  error,
  invalid: invalidProp,
  htmlFor,
  labelTarget = "htmlFor",
  variant = "field",
  orientation = "vertical",
  controlPosition = "end",
  ...props
}: BaseFormFieldProps) {
  const context = useContext(fieldContext) as {
    name: string;
    state: { meta: { isValid?: boolean; errors: unknown[] } };
  } | null;
  const generatedId = useId();
  const label = props.label;
  const description = props.description;
  const hasDescription =
    description != null && description !== "" && description !== false;
  const required = props.required ?? false;
  const disabled = props.disabled ?? false;
  const id = htmlFor ?? generatedId;
  const labelId = id + "-label";
  const descriptionId = id + "-description";
  const errorId = id + "-error";
  const errors = normalizeFieldErrors(context?.state.meta.errors ?? []);
  const invalid =
    invalidProp ??
    (error != null ||
      errors.length > 0 ||
      context?.state.meta.isValid === false);
  const hasError = invalid && (error != null || errors.length > 0);
  const describedBy =
    [hasDescription ? descriptionId : undefined, hasError ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const accessibleLabel =
    props.ariaLabel ??
    (typeof label === "string" ? label : context?.name) ??
    "حقل";
  const labelClassName = props.labelClassName;
  const controlProps: BaseFormFieldControlProps = {
    id,
    disabled,
    required,
    "aria-invalid": invalid,
    "aria-required": required || undefined,
    "aria-describedby": describedBy,
    "aria-labelledby": label ? labelId : undefined,
    "aria-label": !label ? accessibleLabel : undefined,
  };
  const control =
    typeof children === "function" ? children(controlProps) : children;
  const header = (
    <FormFieldLabel
      label={label}
      description={description}
      required={required}
      htmlFor={id}
      id={labelId}
      labelTarget={labelTarget}
      labelClassName={labelClassName}
      ariaLabel={accessibleLabel}
    />
  );
  const helpWithoutLabel =
    !label && hasDescription ? (
      <div className="flex items-center">
        <FormFieldHelp label={accessibleLabel} description={description} />
      </div>
    ) : null;
  const hiddenDescription = hasDescription ? (
    <FieldDescription id={descriptionId} className="sr-only">
      {description}
    </FieldDescription>
  ) : null;
  const errorContent = hasError ? (
    <FieldError
      id={errorId}
      className="text-start"
      errors={error == null ? errors : undefined}
    >
      {error}
    </FieldError>
  ) : null;
  const className = cn(fieldProps?.className, props.className);

  if (variant === "fieldset") {
    return (
      <FieldSet
        disabled={disabled}
        className={className}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      >
        <FieldLegend
          variant="label"
          className={cn("flex items-center gap-1.5", !label && "sr-only")}
        >
          <span id={labelId} className={labelClassName}>
            {label || accessibleLabel}
            {required ? (
              <span aria-hidden="true" className="ms-1 text-destructive">
                *
              </span>
            ) : null}
          </span>
          {label ? (
            <FormFieldHelp label={accessibleLabel} description={description} />
          ) : null}
        </FieldLegend>
        {hiddenDescription}
        {control}
        {helpWithoutLabel}
        {errorContent}
      </FieldSet>
    );
  }

  return (
    <Field
      {...fieldProps}
      className={className}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      aria-labelledby={label ? labelId : undefined}
      aria-label={!label ? accessibleLabel : undefined}
      aria-describedby={describedBy}
    >
      {orientation === "horizontal" ? (
        <div className="flex items-center gap-3">
          {controlPosition === "start" ? control : null}
          {label ? <FieldContent>{header}</FieldContent> : null}
          {controlPosition === "end" ? control : null}
          {helpWithoutLabel}
        </div>
      ) : (
        <>
          {header}
          {control}
          {helpWithoutLabel}
        </>
      )}
      {hiddenDescription}
      {errorContent}
    </Field>
  );
}
