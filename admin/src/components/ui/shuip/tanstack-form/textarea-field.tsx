"use client";

import { useId } from "react";

import { InfoIcon } from "lucide-react";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TextareaFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<typeof InputGroupTextarea>;
  tooltip?: React.ReactNode;
}

export function TextareaField({
  required,
  label,
  description,
  fieldProps,
  props,
  tooltip,
}: TextareaFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = props?.id ?? generatedId;
  const { isValid } = field.state.meta;

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
        <InputGroupTextarea
          name={field.name}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
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
          <InputGroupAddon align="block-end" className="justify-end">
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
