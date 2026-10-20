import { useRef, useState, type ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { Check, ChevronsUpDown, FileText, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TagsSelect } from "@/components/ui/tags-select";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  allFieldsSchema,
  channelSchema,
  collectionSchema,
  createExampleValues,
  layoutSchema,
  placementSchema,
  serializeFormValues,
  statusSchema,
  type SubmittedFieldValues,
} from "../all-fields-schema";

const textFields = [
  {
    name: "title",
    label: "Product name · Text",
    type: "text",
    autoComplete: "off",
  },
  { name: "email", label: "Email", type: "email", autoComplete: "off" },
  {
    name: "password",
    label: "Demo password",
    type: "password",
    autoComplete: "new-password",
  },
  { name: "search", label: "Search", type: "search", autoComplete: "off" },
  { name: "website", label: "Website · URL", type: "url", autoComplete: "off" },
  { name: "phone", label: "Telephone", type: "tel", autoComplete: "off" },
  {
    name: "launchDate",
    label: "Launch date",
    type: "date",
    autoComplete: "off",
  },
  {
    name: "launchTime",
    label: "Launch time",
    type: "time",
    autoComplete: "off",
  },
  { name: "color", label: "Color", type: "color", autoComplete: "off" },
] as const;

const collections = [
  { value: "accessories", label: "Accessories" },
  { value: "home", label: "Home & living" },
  { value: "apparel", label: "Apparel" },
] as const;

const tagOptions = [
  {
    value: "new-arrival",
    label: "New arrival",
    description: "Recently added to the catalog",
  },
  {
    value: "best-seller",
    label: "Best seller",
    description: "Popular with customers",
  },
  {
    value: "sustainable",
    label: "Sustainable",
    description: "Made with lower-impact materials",
  },
  { value: "handmade", label: "Handmade", description: "Crafted by hand" },
  {
    value: "limited-edition",
    label: "Limited edition",
    description: "Available in a limited quantity",
  },
  { value: "sale", label: "Sale", description: "Included in a promotion" },
] as const;

type FrameProps = {
  id: string;
  label: string;
  errors: Array<{ message?: string } | undefined>;
  description?: string;
  children: ReactNode;
};

function FieldFrame({ id, label, errors, description, children }: FrameProps) {
  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`} errors={errors} />
    </Field>
  );
}

export function AllFieldsForm() {
  const [submitted, setSubmitted] = useState<{
    values: SubmittedFieldValues;
    submittedAt: string;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useForm({
    defaultValues: createExampleValues(),
    validators: { onChange: allFieldsSchema, onSubmit: allFieldsSchema },
    onSubmit: ({ value }) => {
      const validated = allFieldsSchema.parse(value);
      setSubmitted({
        values: serializeFormValues(validated),
        submittedAt: new Date().toISOString(),
      });
      toast.success("Form submitted", {
        description: "The submitted values are ready to inspect.",
      });
    },
  });

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">TanStack Form</Badge>
          <Badge variant="secondary">Zod validation</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          All fields, one form
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Edit the example values, then submit to inspect the complete JSON
          output. Clear a required field to try validation. All values stay in
          this local preview.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <form
          id="all-fields-form"
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
                Strings, numeric values, and grouped inputs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldLegend className="sr-only">
                  Text, numbers, and dates
                </FieldLegend>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  {textFields.map((input) => (
                    <form.Field key={input.name} name={input.name}>
                      {(field) => (
                        <FieldFrame
                          id={`all-${field.name}`}
                          label={input.label}
                          errors={field.state.meta.errors}
                        >
                          <Input
                            id={`all-${field.name}`}
                            name={field.name}
                            type={input.type}
                            autoComplete={input.autoComplete}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            aria-invalid={field.state.meta.errors.length > 0}
                            aria-describedby={`all-${field.name}-error`}
                          />
                        </FieldFrame>
                      )}
                    </form.Field>
                  ))}
                  <form.Field name="quantity">
                    {(field) => (
                      <FieldFrame
                        id="all-quantity"
                        label="Quantity · Number"
                        errors={field.state.meta.errors}
                      >
                        <Input
                          id="all-quantity"
                          name={field.name}
                          type="number"
                          min={1}
                          max={10000}
                          step={1}
                          value={
                            Number.isNaN(field.state.value)
                              ? ""
                              : field.state.value
                          }
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.valueAsNumber)
                          }
                          aria-invalid={field.state.meta.errors.length > 0}
                          aria-describedby="all-quantity-error"
                        />
                      </FieldFrame>
                    )}
                  </form.Field>
                  <form.Field name="price">
                    {(field) => (
                      <FieldFrame
                        id="all-price"
                        label="Price · Input group"
                        errors={field.state.meta.errors}
                      >
                        <InputGroup>
                          <InputGroupAddon>$</InputGroupAddon>
                          <InputGroupInput
                            id="all-price"
                            name={field.name}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={
                              Number.isNaN(field.state.value)
                                ? ""
                                : field.state.value
                            }
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.valueAsNumber)
                            }
                            aria-invalid={field.state.meta.errors.length > 0}
                            aria-describedby="all-price-error"
                          />
                          <InputGroupAddon align="inline-end">
                            USD
                          </InputGroupAddon>
                        </InputGroup>
                      </FieldFrame>
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <FieldFrame
                        id="all-description"
                        label="Description · Textarea"
                        errors={field.state.meta.errors}
                      >
                        <Textarea
                          id="all-description"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={field.state.meta.errors.length > 0}
                          aria-describedby="all-description-error"
                        />
                      </FieldFrame>
                    )}
                  </form.Field>
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Choices and settings</CardTitle>
              <CardDescription>
                Select menus, radio buttons, checkboxes, and a searchable
                combobox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <form.Field name="collection">
                  {(field) => (
                    <FieldFrame
                      id="all-collection"
                      label="Collection · Select"
                      errors={field.state.meta.errors}
                    >
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(collectionSchema.parse(value))
                        }
                      >
                        <SelectTrigger
                          id="all-collection"
                          onBlur={field.handleBlur}
                          aria-invalid={field.state.meta.errors.length > 0}
                          aria-describedby="all-collection-error"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {collections.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="status">
                  {(field) => (
                    <FieldFrame
                      id="all-status"
                      label="Status · Native select"
                      errors={field.state.meta.errors}
                    >
                      <NativeSelect
                        id="all-status"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            statusSchema.parse(event.target.value)
                          )
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby="all-status-error"
                      >
                        {statusSchema.options.map((status) => (
                          <NativeSelectOption key={status} value={status}>
                            {status}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="publishingStatus">
                  {(field) => (
                    <FieldSet>
                      <FieldLegend variant="label" id="all-publishing-label">
                        Publishing status · Radio group
                      </FieldLegend>
                      <RadioGroup
                        value={field.state.value}
                        name={field.name}
                        aria-labelledby="all-publishing-label"
                        onBlur={field.handleBlur}
                        onValueChange={(value) =>
                          field.handleChange(statusSchema.parse(value))
                        }
                      >
                        {statusSchema.options.map((status) => (
                          <Field key={status} orientation="horizontal">
                            <RadioGroupItem
                              id={`all-radio-${status}`}
                              value={status}
                            />
                            <FieldLabel htmlFor={`all-radio-${status}`}>
                              {status}
                            </FieldLabel>
                          </Field>
                        ))}
                      </RadioGroup>
                      <FieldError errors={field.state.meta.errors} />
                    </FieldSet>
                  )}
                </form.Field>
                <form.Field name="channels">
                  {(field) => (
                    <FieldSet data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLegend variant="label">
                        Sales channels · Checkboxes
                      </FieldLegend>
                      <FieldGroup className="gap-3">
                        {channelSchema.options.map((channel) => (
                          <Field key={channel} orientation="horizontal">
                            <Checkbox
                              id={`all-channel-${channel}`}
                              name={field.name}
                              value={channel}
                              checked={field.state.value.includes(channel)}
                              onBlur={field.handleBlur}
                              aria-invalid={field.state.meta.errors.length > 0}
                              aria-describedby="all-channels-error"
                              onCheckedChange={(checked) =>
                                field.handleChange(
                                  checked === true
                                    ? [...field.state.value, channel]
                                    : field.state.value.filter(
                                        (item) => item !== channel
                                      )
                                )
                              }
                            />
                            <FieldLabel htmlFor={`all-channel-${channel}`}>
                              {channel}
                            </FieldLabel>
                          </Field>
                        ))}
                      </FieldGroup>
                      <FieldError
                        id="all-channels-error"
                        errors={field.state.meta.errors}
                      />
                    </FieldSet>
                  )}
                </form.Field>
                <form.Field name="category">
                  {(field) => (
                    <FieldFrame
                      id="all-category"
                      label="Category · Combobox"
                      errors={field.state.meta.errors}
                    >
                      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="all-category"
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={pickerOpen}
                            aria-invalid={field.state.meta.errors.length > 0}
                            aria-describedby="all-category-error"
                            className="justify-between"
                            onBlur={field.handleBlur}
                          >
                            {
                              collections.find(
                                (option) => option.value === field.state.value
                              )?.label
                            }
                            <ChevronsUpDown data-icon="inline-end" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="p-0">
                          <Command>
                            <CommandInput placeholder="Search categories…" />
                            <CommandList>
                              <CommandEmpty>No categories found.</CommandEmpty>
                              <CommandGroup>
                                {collections.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                      field.handleChange(option.value);
                                      setPickerOpen(false);
                                    }}
                                  >
                                    {option.label}
                                    {field.state.value === option.value ? (
                                      <Check data-icon="inline-end" />
                                    ) : null}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="published">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Checkbox
                        id="all-published"
                        checked={field.state.value}
                        onBlur={field.handleBlur}
                        onCheckedChange={(value) =>
                          field.handleChange(value === true)
                        }
                      />
                      <FieldLabel htmlFor="all-published">
                        Published · Checkbox boolean
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="notifications">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Switch
                        id="all-notifications"
                        checked={field.state.value}
                        onBlur={field.handleBlur}
                        onCheckedChange={field.handleChange}
                      />
                      <FieldLabel htmlFor="all-notifications">
                        Low-stock alerts · Switch
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="discount">
                  {(field) => (
                    <FieldFrame
                      id="all-discount"
                      label={`Discount · Slider (${field.state.value}%)`}
                      errors={field.state.meta.errors}
                    >
                      <Slider
                        id="all-discount"
                        aria-label="Discount"
                        min={0}
                        max={100}
                        step={1}
                        value={[field.state.value]}
                        onBlur={field.handleBlur}
                        onValueChange={([value]) => {
                          if (value !== undefined) field.handleChange(value);
                        }}
                      />
                    </FieldFrame>
                  )}
                </form.Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags and checkbox selection</CardTitle>
              <CardDescription>
                Search for tags, select their checkboxes, and remove selected
                chips.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field name="tags">
                {(field) => (
                  <FieldFrame
                    id="all-tags"
                    label="Product tags"
                    errors={field.state.meta.errors}
                    description="Choose between 1 and 5 tags. Two chips stay visible; extra selections appear as +N. All selected IDs are included in the submitted JSON."
                  >
                    <TagsSelect
                      id="all-tags"
                      maxVisibleTags={2}
                      options={tagOptions}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby="all-tags-error"
                    />
                  </FieldFrame>
                )}
              </form.Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Composed controls</CardTitle>
              <CardDescription>
                Verification, layout, and campaign settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <form.Field name="verificationCode">
                  {(field) => (
                    <FieldFrame
                      id="all-code"
                      label="Verification code · Input OTP"
                      errors={field.state.meta.errors}
                    >
                      <InputOTP
                        id="all-code"
                        name={field.name}
                        maxLength={6}
                        inputMode="numeric"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby="all-code-error"
                      >
                        <InputOTPGroup>
                          {[0, 1, 2].map((index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          {[3, 4, 5].map((index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="layout">
                  {(field) => (
                    <FieldSet>
                      <FieldLegend variant="label" id="all-layout-label">
                        Layout · Single toggle group
                      </FieldLegend>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.state.value}
                        aria-labelledby="all-layout-label"
                        onBlur={field.handleBlur}
                        onValueChange={(value) => {
                          if (value)
                            field.handleChange(layoutSchema.parse(value));
                        }}
                      >
                        {layoutSchema.options.map((layout) => (
                          <ToggleGroupItem key={layout} value={layout}>
                            {layout}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FieldSet>
                  )}
                </form.Field>
                <form.Field name="featured">
                  {(field) => (
                    <FieldFrame
                      id="all-featured"
                      label="Featured · Toggle"
                      errors={field.state.meta.errors}
                    >
                      <Toggle
                        id="all-featured"
                        type="button"
                        variant="outline"
                        pressed={field.state.value}
                        onBlur={field.handleBlur}
                        onPressedChange={field.handleChange}
                      >
                        {field.state.value ? "Featured" : "Not featured"}
                      </Toggle>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="placements">
                  {(field) => (
                    <FieldSet data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLegend variant="label" id="all-placements-label">
                        Placements · Multi-select toggle group
                      </FieldLegend>
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        value={field.state.value}
                        aria-labelledby="all-placements-label"
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby="all-placements-error"
                        onBlur={field.handleBlur}
                        onValueChange={(value) =>
                          field.handleChange(
                            placementSchema.array().parse(value)
                          )
                        }
                      >
                        {placementSchema.options.map((placement) => (
                          <ToggleGroupItem key={placement} value={placement}>
                            {placement}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <FieldError
                        id="all-placements-error"
                        errors={field.state.meta.errors}
                      />
                    </FieldSet>
                  )}
                </form.Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>File attachments</CardTitle>
              <CardDescription>
                Up to 5 files, 10 MB each. The output shows file metadata.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field name="attachments">
                {(field) => (
                  <FieldFrame
                    id="all-attachments"
                    label="Attach files"
                    errors={field.state.meta.errors}
                    description="Files remain in browser memory. No upload request is sent."
                  >
                    <Input
                      ref={fileInput}
                      id="all-attachments"
                      name={field.name}
                      type="file"
                      multiple
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby="all-attachments-error"
                      onChange={(event) => {
                        field.handleChange([
                          ...field.state.value,
                          ...Array.from(event.target.files ?? []),
                        ]);
                        event.target.value = "";
                      }}
                    />
                    {field.state.value.length ? (
                      <AttachmentGroup aria-label="Selected attachments">
                        {field.state.value.map((file, index) => (
                          <Attachment
                            key={`${file.name}-${file.lastModified}-${index}`}
                            state="idle"
                          >
                            <AttachmentMedia>
                              <FileText />
                            </AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>{file.name}</AttachmentTitle>
                              <AttachmentDescription>
                                {file.type || "Unknown type"} ·{" "}
                                {file.size.toLocaleString()} bytes
                              </AttachmentDescription>
                            </AttachmentContent>
                            <AttachmentActions>
                              <AttachmentAction
                                type="button"
                                aria-label={`Remove ${file.name}`}
                                onClick={() =>
                                  field.handleChange(
                                    field.state.value.filter(
                                      (_, itemIndex) => itemIndex !== index
                                    )
                                  )
                                }
                              >
                                <X />
                              </AttachmentAction>
                            </AttachmentActions>
                          </Attachment>
                        ))}
                      </AttachmentGroup>
                    ) : (
                      <FieldDescription>
                        No attachments selected.
                      </FieldDescription>
                    )}
                  </FieldFrame>
                )}
              </form.Field>
            </CardContent>
          </Card>

          <form.Subscribe
            selector={(state) =>
              [
                state.isSubmitting,
                state.isValid,
                state.submissionAttempts,
              ] as const
            }
          >
            {([isSubmitting, isValid, attempts]) => (
              <div className="flex flex-col gap-3">
                {attempts > 0 && !isValid ? (
                  <p role="alert" className="text-sm text-destructive">
                    Please fix the highlighted fields, then submit again. The
                    last successful output stays visible.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <LoaderCircle
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <Check data-icon="inline-start" />
                    )}
                    {isSubmitting ? "Submitting…" : "Submit all fields"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => {
                      form.reset(createExampleValues());
                      setSubmitted(null);
                      setPickerOpen(false);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    Reset form & output
                  </Button>
                </div>
              </div>
            )}
          </form.Subscribe>
        </form>

        <aside
          className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24"
          aria-label="Form values inspector"
        >
          <Card>
            <CardHeader>
              <CardTitle>Submitted values</CardTitle>
              <CardDescription>
                Snapshot from the last successful Zod-validated submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-3">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    form="all-fields-form"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting…" : "Submit & inspect JSON"}
                  </Button>
                )}
              </form.Subscribe>
              <div aria-live="polite" aria-atomic="true" className="min-w-0">
                {submitted ? (
                  <div className="flex min-w-0 flex-col gap-3">
                    <Badge variant="secondary">Validation passed</Badge>
                    <p className="text-xs text-muted-foreground">
                      Submitted at{" "}
                      <time dateTime={submitted.submittedAt}>
                        {new Date(submitted.submittedAt).toLocaleTimeString()}
                      </time>
                    </p>
                    <pre
                      data-testid="submitted-values"
                      className="max-h-[65vh] overflow-auto rounded-lg border bg-muted p-4 text-xs leading-relaxed"
                    >
                      <code>{JSON.stringify(submitted.values, null, 2)}</code>
                    </pre>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No values submitted yet. Use either submit button to see all
                    field values here.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Numbers stay numbers, switches are booleans, and multi-select
                controls produce arrays. Attachments show metadata instead of
                file bytes.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Live form state</CardTitle>
            </CardHeader>
            <CardContent>
              <form.Subscribe
                selector={(state) =>
                  [
                    state.isDirty,
                    state.isValid,
                    state.isSubmitting,
                    state.submissionAttempts,
                  ] as const
                }
              >
                {([dirty, valid, submitting, attempts]) => (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <dt>isDirty</dt>
                    <dd>{String(dirty)}</dd>
                    <dt>isValid</dt>
                    <dd>{String(valid)}</dd>
                    <dt>isSubmitting</dt>
                    <dd>{String(submitting)}</dd>
                    <dt>Submit attempts</dt>
                    <dd>{attempts}</dd>
                  </dl>
                )}
              </form.Subscribe>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
