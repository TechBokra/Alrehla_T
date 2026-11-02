import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { useAppForm } from "@/lib/form";
import { createResourcePage } from "@/components/resources/page";
import type { ResourceFormFieldsContext } from "@/components/resources/types";
import { FieldGroup } from "@/components/ui/field";
import { ScopeTargetsField } from "./scope-targets-field";
import {
  CATALOG_SETTINGS_PROVIDER,
  catalogSettingsError,
  personalizationDialogSchema,
  personalizationPayload,
  personalizationValues,
  type CustomizationField,
  type StoryGoal,
  type PersonalizationKind,
  type PersonalizationRecord,
} from "./model";

export const customizationFieldForm = createResourcePage<CustomizationField>({
  kind: "form",
  resource: "customization_fields",
  dataProviderName: CATALOG_SETTINGS_PROVIDER,
  dialog: {
    title: "خانة تخصيص",
    getErrorMessage: catalogSettingsError,
    fields: (context) => (
      <PersonalizationDialogFields {...context} kind="field" />
    ),
  },
});
export const storyGoalForm = createResourcePage<StoryGoal>({
  kind: "form",
  resource: "story_goals",
  dataProviderName: CATALOG_SETTINGS_PROVIDER,
  dialog: {
    title: "هدف تخصيص",
    getErrorMessage: catalogSettingsError,
    fields: (context) => (
      <PersonalizationDialogFields {...context} kind="goal" />
    ),
  },
});

function PersonalizationDialogFields({
  kind,
  record,
  formId,
  disabled,
  onFormValidityChange,
  onSave,
}: ResourceFormFieldsContext<PersonalizationRecord> & {
  kind: PersonalizationKind;
}) {
  const [defaultValues] = useState(() => personalizationValues(record));
  const [schema] = useState(() => personalizationDialogSchema(kind));
  const form = useAppForm({
    defaultValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSave(personalizationPayload(kind, value));
    },
  });
  const valid = useStore(form.store, (state) => state.isFormValid);
  const scope = useStore(form.store, (state) => state.values.scope);
  useEffect(() => onFormValidityChange(valid), [valid, onFormValidityChange]);
  return (
    <form.AppForm>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.AppField name="label">
            {(Fields) => (
              <Fields.InputField
                required
                label={kind === "field" ? "اسم الخانة" : "الهدف"}
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          {kind === "field" ? (
            <>
              <form.AppField name="placeholder">
                {(Fields) => (
                  <Fields.InputField
                    label="مثال داخل الخانة"
                    props={{ disabled, dir: "auto" }}
                  />
                )}
              </form.AppField>
              <form.AppField name="isRequired">
                {(Fields) => (
                  <Fields.CheckboxField
                    label="الخانة إلزامية"
                    props={{ disabled }}
                  />
                )}
              </form.AppField>
            </>
          ) : null}
          <form.AppField name="scope">
            {(Fields) => (
              <Fields.SelectField
                label="يظهر في"
                options={{
                  "كل المنتجات وصندوق الرحلة": "all",
                  "منتجات محددة أو صندوق الرحلة": "selected",
                }}
                props={{ disabled }}
              />
            )}
          </form.AppField>
          {scope === "selected" ? (
            <form.AppField name="targets">
              {() => <ScopeTargetsField disabled={disabled} />}
            </form.AppField>
          ) : null}
          <form.AppField name="isActive">
            {(Fields) => (
              <Fields.CheckboxField label="ظاهر للعملاء" props={{ disabled }} />
            )}
          </form.AppField>
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
