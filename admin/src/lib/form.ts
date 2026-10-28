import { createFormHook } from "@tanstack/react-form";
import {
  fieldContext,
  formContext,
} from "@/components/ui/shuip/tanstack-form/form-context";
import { SubmitButton } from "@/components/ui/shuip/tanstack-form/submit-button";
import { FormActions } from "@/components/forms/components/form-actions";
import { FormErrorSummary } from "@/components/forms/components/form-error-summary";
import { ImageUploadField } from "@/components/forms/fields/image-upload-field";
import { AttachmentsField } from "@/components/forms/fields/attachments-field";
import { AutocompleteField } from "@/components/ui/shuip/tanstack-form/autocomplete-field";
import { CheckboxField } from "@/components/ui/shuip/tanstack-form/checkbox-field";
import { ComboboxField } from "@/components/ui/shuip/tanstack-form/combobox-field";
import { DateField } from "@/components/ui/shuip/tanstack-form/date-field";
import { DateRangeField } from "@/components/ui/shuip/tanstack-form/date-range-field";
import { DatetimeField } from "@/components/ui/shuip/tanstack-form/datetime-field";
import { InlineEditField } from "@/components/ui/shuip/tanstack-form/inline-edit";
import { InputField } from "@/components/ui/shuip/tanstack-form/input-field";
import { MonthField } from "@/components/ui/shuip/tanstack-form/month-field";
import { PasswordField } from "@/components/ui/shuip/tanstack-form/password-field";
import { RadioField } from "@/components/ui/shuip/tanstack-form/radio-field";
import { SelectField } from "@/components/ui/shuip/tanstack-form/select-field";
import { TextareaField } from "@/components/ui/shuip/tanstack-form/textarea-field";
import { TimeField } from "@/components/ui/shuip/tanstack-form/time-field";
import { TimeRangeField } from "@/components/ui/shuip/tanstack-form/time-range";
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    AutocompleteField,
    CheckboxField,
    ComboboxField,
    DateField,
    DateRangeField,
    DatetimeField,
    InlineEditField,
    InputField,
    MonthField,
    PasswordField,
    RadioField,
    SelectField,
    TextareaField,
    TimeField,
    TimeRangeField,
    ImageUploadField,
    AttachmentsField,
  },
  formComponents: {
    SubmitButton,
    FormActions,
    FormErrorSummary,
  },
});
