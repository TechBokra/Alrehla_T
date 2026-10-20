"use client";

import * as React from "react";
import { cn } from "cn";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

export type FormSectionProps = Omit<
  React.ComponentProps<typeof FieldSet>,
  "children"
> & {
  title: string;
  description?: string;
  sectionId?: string;
  children: React.ReactNode;
  fieldsClassName?: string;
};

export function FormSection({
  title,
  description,
  sectionId,
  children,
  fieldsClassName,
  className,
  ...props
}: FormSectionProps) {
  const id = React.useId();
  const descriptionId = id + "-description";

  return (
    <FieldSet
      id={id}
      data-form-section={sectionId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("scroll-mt-24 md:scroll-mt-4", className)}
      {...props}
    >
      <FieldLegend>{title}</FieldLegend>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldGroup className={fieldsClassName}>{children}</FieldGroup>
    </FieldSet>
  );
}
