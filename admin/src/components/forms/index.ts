export { useAppForm, withFieldGroup, withForm } from "@/lib/form";

export {
  FormActions,
  FormErrorSummary,
  BaseFormField,
  FormFieldLabel,
  FormFieldHelp,
} from "./components";
export type {
  BaseFormFieldProps,
  BaseFormFieldControlProps,
  FormFieldLabelProps,
  FormFieldHelpProps,
} from "./components";
export type { FieldProps, FormFieldPresentationProps, Option } from "./types";

export { FormDialog, type FormDialogProps } from "./layouts/form-dialog";
export { FormSheet, type FormSheetProps } from "./layouts/form-sheet";
export { FormSection, type FormSectionProps } from "./layouts/form-section";
export {
  FormSectionsDialog,
  FormSectionPanel,
  type FormSectionNavigationItem,
  type FormSectionPanelProps,
  type FormSectionsDialogProps,
} from "./layouts/form-sections-dialog";

export { DescriptionBadge } from "./components/field-help";
