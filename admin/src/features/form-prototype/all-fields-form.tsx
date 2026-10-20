"use client";

import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  allFieldsSchema,
  createExampleValues,
  serializeFormValues,
  type AllFieldsValues,
  type SubmittedFieldValues,
} from "../component-showcase/all-fields-schema";
import { useAppForm } from "@/components/forms";

const choices = {
  collection: [
    { value: "accessories", label: "Accessories" },
    { value: "home", label: "Home & living" },
    { value: "apparel", label: "Apparel" },
  ],
  status: [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ],
  channels: [
    { value: "storefront", label: "Storefront" },
    { value: "marketplace", label: "Marketplace" },
    { value: "pos", label: "Point of sale" },
  ],
  layout: [
    { value: "grid", label: "Grid" },
    { value: "list", label: "List" },
    { value: "compact", label: "Compact" },
  ],
  placements: [
    { value: "storefront", label: "Storefront" },
    { value: "email", label: "Email" },
    { value: "social", label: "Social" },
  ],
  tags: [
    {
      value: "new-arrival",
      label: "New arrival",
      description: "Recently added to the catalog",
    },
    {
      value: "best-seller",
      label: "Best seller",
      description: "A customer favorite",
    },
    {
      value: "sustainable",
      label: "Sustainable",
      description: "Made with considered materials",
    },
    { value: "handmade", label: "Handmade", description: "Crafted by hand" },
    {
      value: "limited-edition",
      label: "Limited edition",
      description: "Available in a limited run",
    },
    { value: "sale", label: "Sale", description: "Currently discounted" },
  ],
} as const;

type FieldOutput = {
  values: SubmittedFieldValues;
  submittedAt: string;
};

function jsonForDisplay(values: AllFieldsValues) {
  return serializeFormValues(values);
}

export function AllFieldsForm() {
  const [submitted, setSubmitted] = useState<FieldOutput | null>(null);
  const form = useAppForm({
    defaultValues: createExampleValues(),
    validators: {
      onChange: allFieldsSchema,
      onSubmit: allFieldsSchema,
    },
    onSubmit: ({ value }) => {
      const parsed = allFieldsSchema.parse(value);
      setSubmitted({
        values: serializeFormValues(parsed),
        submittedAt: new Date().toISOString(),
      });
    },
  });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">createFormHook</Badge>
          <Badge variant="secondary">TanStack Form + Zod</Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          All fields, one typed form
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each control is bound through the local hook registry. Edit the
          values, inspect live form state, and submit to see the serialized
          output. Attachments stay in browser memory; this form sends nothing.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <form.AppForm>
          <form
            className="flex min-w-0 flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Text, numbers, and dates</CardTitle>
                <CardDescription>
                  The same app fields adapt their primitive to each value type.
                  Descriptions appear beside visible labels; fields without a
                  label show them below the control.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="title">
                    {(field) => (
                      <field.Input
                        label="Product name · Input"
                        description="Use a clear customer-facing name; this appears in the catalog and product pages."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="email">
                    {(field) => <field.Input label="Email" type="email" />}
                  </form.AppField>
                  <form.AppField name="password">
                    {(field) => (
                      <field.Input label="Demo password" type="password" />
                    )}
                  </form.AppField>
                  <form.AppField name="search">
                    {(field) => (
                      <field.GroupedInput
                        ariaLabel="Search · Input group"
                        description="Search by product name or SKU. Help appears below the control when its visible label is omitted."
                        prefix="Find"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="website">
                    {(field) => (
                      <field.Input label="Website · URL" type="url" />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => <field.Input label="Telephone" type="tel" />}
                  </form.AppField>
                  <form.AppField name="quantity">
                    {(field) => (
                      <field.Number
                        label="Quantity · Number"
                        min={1}
                        max={10000}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="price">
                    {(field) => (
                      <field.Number label="Price" min={0} step={0.01} />
                    )}
                  </form.AppField>
                  <form.AppField name="launchDate">
                    {(field) => <field.Date label="Launch date · Date" />}
                  </form.AppField>
                  <form.AppField name="launchTime">
                    {(field) => <field.Time label="Launch time · Time" />}
                  </form.AppField>
                  <form.AppField name="color">
                    {(field) => <field.Color label="Accent color · Color" />}
                  </form.AppField>
                  <form.AppField name="verificationCode">
                    {(field) => <field.OTP label="Verification code · OTP" />}
                  </form.AppField>
                </FieldGroup>
                <div className="mt-5">
                  <form.AppField name="description">
                    {(field) => (
                      <field.Textarea label="Description · Textarea" rows={4} />
                    )}
                  </form.AppField>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Choices and tags</CardTitle>
                <CardDescription>
                  Select, native select, searchable choice, and tag checkbox
                  patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="collection">
                    {(field) => (
                      <field.Select
                        label="Collection · Select"
                        options={choices.collection}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="status">
                    {(field) => (
                      <field.NativeSelect
                        label="Status · Native select"
                        options={choices.status}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="category">
                    {(field) => (
                      <field.Combobox
                        label="Category · Searchable combobox"
                        options={choices.collection}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="channels">
                    {(field) => (
                      <field.CheckboxGroup
                        label="Sales channels · Checkbox group"
                        description="Choose where this product can be discovered or purchased."
                        options={choices.channels}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="publishingStatus">
                    {(field) => (
                      <field.RadioGroup
                        label="Publishing status · Radio group"
                        description="Draft stays hidden, active is available, and archived is retired."
                        options={choices.status}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="tags">
                    {(field) => (
                      <field.Tags
                        label="Product tags · Searchable checkbox popover"
                        options={[...choices.tags]}
                        maxVisibleTags={2}
                        description="Choose one to five tags. Extra selections appear as +N; all tag IDs remain in the value."
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Boolean and composed controls</CardTitle>
                <CardDescription>
                  Checkboxes, switches, sliders, and single or multiple toggle
                  groups.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="published">
                    {(field) => (
                      <field.Checkbox
                        label="Published · Checkbox"
                        description="Published products can appear on enabled sales channels."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="notifications">
                    {(field) => (
                      <field.Switch
                        label="Notifications · Switch"
                        description="Send notifications when product previews change."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="discount">
                    {(field) => (
                      <field.Slider
                        label="Discount · Slider"
                        min={0}
                        max={100}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="featured">
                    {(field) => (
                      <field.Toggle
                        ariaLabel="Featured product toggle"
                        description="Mark this product for featured placements. Help appears below an unlabeled control."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="layout">
                    {(field) => (
                      <field.ToggleGroup
                        label="Layout · Single toggle group"
                        description="Choose how products appear in the catalog preview."
                        options={choices.layout}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="placements">
                    {(field) => (
                      <field.ToggleGroup
                        label="Placements · Multiple toggle group"
                        options={choices.placements}
                        multiple
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>File attachments</CardTitle>
                <CardDescription>
                  Select up to five files, then remove them individually. No
                  upload runs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form.AppField name="attachments">
                  {(field) => (
                    <field.Attachments
                      label="Attach files"
                      maxFiles={5}
                      description="Files remain local to this browser tab. Submitted output contains metadata only."
                    />
                  )}
                </form.AppField>
              </CardContent>
            </Card>

            <form.FormErrorSummary />
            <form.FormActions>
              <form.SubmitButton>Validate and submit</form.SubmitButton>
              <form.ResetButton>Reset values</form.ResetButton>
              <form.UnsavedChangesIndicator />
            </form.FormActions>
          </form>
        </form.AppForm>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Live state</CardTitle>
              <CardDescription>
                Current values and validation update while editing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Subscribe
                selector={(state) =>
                  [state.values, state.isFormValid, state.isSubmitting] as const
                }
              >
                {([values, isFormValid, isSubmitting]) => (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={isFormValid ? "secondary" : "destructive"}
                      >
                        {isFormValid ? "Valid" : "Needs attention"}
                      </Badge>
                      <Badge variant="outline">
                        {isSubmitting ? "Submitting" : "Idle"}
                      </Badge>
                    </div>
                    <pre className="max-h-[420px] overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">
                      {JSON.stringify(jsonForDisplay(values), null, 2)}
                    </pre>
                  </div>
                )}
              </form.Subscribe>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last successful submit</CardTitle>
              <CardDescription>
                Invalid submissions leave the last output visible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(submitted.submittedAt).toLocaleString()}
                  </p>
                  <pre className="max-h-[360px] overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">
                    {JSON.stringify(submitted.values, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Submit a valid form to capture its JSON values.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
