import { FormAttachments } from "./form-attachments";
import { FormCheckbox } from "./form-checkbox";
import { FormCheckboxGroup } from "./form-checkbox-group";
import { FormColor } from "./form-color";
import { FormCombobox } from "./form-combobox";
import { FormDate } from "./form-date";
import { FormGroupedInput } from "./form-grouped-input";
import { FormInput } from "./form-input";
import { FormNativeSelect } from "./form-native-select";
import { FormNumber } from "./form-number";
import { FormOTP } from "./form-otp";
import { FormRadioGroup } from "./form-radio-group";
import { FormSelect } from "./form-select";
import { FormSlider } from "./form-slider";
import { FormSwitch } from "./form-switch";
import { FormTags } from "./form-tags";
import { FormTextarea } from "./form-textarea";
import { FormTime } from "./form-time";
import { FormToggle } from "./form-toggle";
import { FormToggleGroup } from "./form-toggle-group";

export const adminFieldComponents = {
  Input: FormInput,
  Textarea: FormTextarea,
  Number: FormNumber,
  Date: FormDate,
  Time: FormTime,
  Color: FormColor,
  Select: FormSelect,
  NativeSelect: FormNativeSelect,
  Combobox: FormCombobox,
  Checkbox: FormCheckbox,
  CheckboxGroup: FormCheckboxGroup,
  RadioGroup: FormRadioGroup,
  Switch: FormSwitch,
  Slider: FormSlider,
  OTP: FormOTP,
  Toggle: FormToggle,
  ToggleGroup: FormToggleGroup,
  Tags: FormTags,
  GroupedInput: FormGroupedInput,
  Attachments: FormAttachments,
};
