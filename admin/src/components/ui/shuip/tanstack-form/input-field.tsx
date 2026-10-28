"use client";

import { useId } from "react";

import { InfoIcon } from "lucide-react";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface InputFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<"input">;
  tooltip?: React.ReactNode;
}

export function InputField({
  required,
  label,
  description,
  fieldProps,
  props,
  tooltip,
}: InputFieldProps) {
  const field = useFieldContext<string | number>();
  const generatedId = useId();
  const controlId = props?.id ?? generatedId;
  const { isValid } = field.state.meta;
  const isNumeric =
    props?.type === "number" ||
    props?.type === "range" ||
    typeof field.state.value === "number";

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={props?.disabled}
    >
      <InputGroup>
        <InputGroupInput
          type={isNumeric ? "number" : "text"}
          name={field.name}
          value={
            typeof field.state.value === "number" &&
            Number.isNaN(field.state.value)
              ? ""
              : field.state.value
          }
          onChange={(e) =>
            field.handleChange(
              isNumeric ? e.target.valueAsNumber : e.target.value,
            )
          }
          onBlur={field.handleBlur}
          aria-describedby={
            [
              description ? controlId + "-description" : undefined,
              !isValid ? controlId + "-error" : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-required={required || undefined}
          aria-invalid={!isValid}
          {...props}
          id={controlId}
          required={required ?? props?.required}
        />
        {tooltip && (
          <InputGroupAddon align="inline-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton aria-label="Info" size="icon-xs">
                  <InfoIcon />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        )}
      </InputGroup>
    </BaseFormField>
  );
}
