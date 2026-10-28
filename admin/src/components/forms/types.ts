import type { ReactNode } from "react";

export type FormFieldPresentationProps = {
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  labelClassName?: string;
};

export type FieldProps = FormFieldPresentationProps & {
  disabled?: boolean;
  ariaLabel?: string;
};

export type Option = {
  value: string;
  label: string;
};
