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
    label: "اسم المنتج · نص",
    type: "text",
    autoComplete: "off",
  },
  { name: "email", label: "البريد الإلكتروني", type: "email", autoComplete: "off" },
  {
    name: "password",
    label: "كلمة مرور تجريبية",
    type: "password",
    autoComplete: "new-password",
  },
  { name: "search", label: "بحث", type: "search", autoComplete: "off" },
  { name: "website", label: "الموقع الإلكتروني · رابط", type: "url", autoComplete: "off" },
  { name: "phone", label: "رقم الهاتف", type: "tel", autoComplete: "off" },
  {
    name: "launchDate",
    label: "تاريخ الإطلاق",
    type: "date",
    autoComplete: "off",
  },
  {
    name: "launchTime",
    label: "وقت الإطلاق",
    type: "time",
    autoComplete: "off",
  },
  { name: "color", label: "اللون", type: "color", autoComplete: "off" },
] as const;

const collections = [
  { value: "accessories", label: "إكسسوارات" },
  { value: "home", label: "المنزل والمعيشة" },
  { value: "apparel", label: "ملابس" },
] as const;

const statusLabels = { draft: "مسودة", active: "نشط", archived: "مؤرشف" } as const;
const channelLabels = { storefront: "المتجر الإلكتروني", marketplace: "سوق إلكتروني", pos: "نقطة البيع" } as const;
const layoutLabels = { grid: "شبكة", list: "قائمة", compact: "مضغوط" } as const;
const placementLabels = { storefront: "المتجر الإلكتروني", email: "البريد الإلكتروني", social: "منصات التواصل" } as const;

const tagOptions = [
  {
    value: "new-arrival",
    label: "وصل حديثًا",
    description: "أُضيف مؤخرًا إلى الكتالوج",
  },
  {
    value: "best-seller",
    label: "الأكثر مبيعًا",
    description: "مفضّل لدى العملاء",
  },
  {
    value: "sustainable",
    label: "مستدام",
    description: "مصنوع بخامات صديقة للبيئة",
  },
  { value: "handmade", label: "صناعة يدوية", description: "مصنوع يدويًا" },
  {
    value: "limited-edition",
    label: "إصدار محدود",
    description: "متوفر بكمية محدودة",
  },
  { value: "sale", label: "تخفيض", description: "ضمن عرض ترويجي" },
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
      toast.success("تم إرسال النموذج", {
        description: "تقدر تراجع البيانات التي أرسلتها.",
      });
    },
  });

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">نموذج TanStack</Badge>
          <Badge variant="secondary">التحقق باستخدام Zod</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          كل الحقول في نموذج واحد
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          عدّل القيم التجريبية ثم أرسل النموذج لمراجعة البيانات. امسح أحد الحقول المطلوبة لتجربة التحقق. تظل البيانات داخل المعاينة فقط.
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
              <CardTitle>النصوص والأرقام والتواريخ</CardTitle>
              <CardDescription>
                حقول النصوص والأرقام وحقول الإدخال المجمّعة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldLegend className="sr-only">
                  النصوص والأرقام والتواريخ
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
                        label="الكمية · رقم"
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
                        label="السعر · إدخال مجمّع"
                        errors={field.state.meta.errors}
                      >
                        <InputGroup>
                          <InputGroupAddon>ج.م.</InputGroupAddon>
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
                            جنيه مصري
                          </InputGroupAddon>
                        </InputGroup>
                      </FieldFrame>
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <FieldFrame
                        id="all-description"
                        label="الوصف · نص متعدد الأسطر"
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
              <CardTitle>الاختيارات والإعدادات</CardTitle>
              <CardDescription>
                قوائم الاختيار وأزرار الخيارات ومربعات التحديد والبحث.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <form.Field name="collection">
                  {(field) => (
                    <FieldFrame
                      id="all-collection"
                      label="المجموعة · قائمة اختيار"
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
                      label="الحالة · قائمة أصلية"
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
                            {statusLabels[status]}
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
                        حالة النشر · أزرار اختيار
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
                            {statusLabels[status]}
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
                        قنوات البيع · مربعات تحديد
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
                              {channelLabels[channel]}
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
                      label="الفئة · بحث واختيار"
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
                            <CommandInput placeholder="ابحث عن فئة…" />
                            <CommandList>
                              <CommandEmpty>لم يتم العثور على فئات.</CommandEmpty>
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
                        منشور · مربع تحديد
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
                        تنبيهات انخفاض المخزون · مفتاح
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="discount">
                  {(field) => (
                    <FieldFrame
                      id="all-discount"
                      label={`الخصم · شريط التمرير (${field.state.value}٪)`}
                      errors={field.state.meta.errors}
                    >
                      <Slider
                        id="all-discount"
                        aria-label="الخصم"
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
              <CardTitle>الوسوم والاختيار بمربعات التحديد</CardTitle>
              <CardDescription>
                ابحث عن الوسوم وحددها بمربعات الاختيار، أو أزل الوسوم المحددة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field name="tags">
                {(field) => (
                  <FieldFrame
                    id="all-tags"
                    label="وسوم المنتج"
                    errors={field.state.meta.errors}
                    description="اختار من وسم إلى ٥ وسوم. تظهر الاختيارات الإضافية كرقم، وتُضمَّن كل المعرفات في البيانات المرسلة."
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
              <CardTitle>عناصر إدخال مركّبة</CardTitle>
              <CardDescription>
                التحقق وتنسيق العرض وإعدادات الحملات.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <form.Field name="verificationCode">
                  {(field) => (
                    <FieldFrame
                      id="all-code"
                      label="رمز التحقق · رمز لمرة واحدة"
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
                        طريقة العرض · اختيار واحد
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
                            {layoutLabels[layout]}
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
                      label="منتج مميز · مفتاح"
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
                        {field.state.value ? "منتج مميز" : "منتج عادي"}
                      </Toggle>
                    </FieldFrame>
                  )}
                </form.Field>
                <form.Field name="placements">
                  {(field) => (
                    <FieldSet data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLegend variant="label" id="all-placements-label">
                        أماكن الظهور · اختيار متعدد
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
                            {placementLabels[placement]}
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
              <CardTitle>المرفقات</CardTitle>
              <CardDescription>
                حتى ٥ ملفات، بحد أقصى ١٠ ميجابايت لكل ملف. تعرض النتيجة بيانات الملفات فقط.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field name="attachments">
                {(field) => (
                  <FieldFrame
                    id="all-attachments"
                    label="إرفاق ملفات"
                    errors={field.state.meta.errors}
                    description="تظل الملفات في ذاكرة المتصفح، ولا يتم رفعها إلى أي مكان."
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
                      <AttachmentGroup aria-label="المرفقات المحددة">
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
                                {file.type || "نوع غير معروف"} ·{" "}
                                {new Intl.NumberFormat("ar-EG").format(file.size)} بايت
                              </AttachmentDescription>
                            </AttachmentContent>
                            <AttachmentActions>
                              <AttachmentAction
                                type="button"
                                aria-label={`إزالة ${file.name}`}
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
                        لم يتم اختيار مرفقات.
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
                    راجع الحقول المحددة ثم أرسل النموذج مرة أخرى. ستظل آخر نتيجة ناجحة ظاهرة.
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
                    {isSubmitting ? "جارٍ الإرسال…" : "إرسال كل البيانات"}
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
                    إعادة ضبط النموذج والنتيجة
                  </Button>
                </div>
              </div>
            )}
          </form.Subscribe>
        </form>

        <aside
          className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24"
          aria-label="مراجع بيانات النموذج"
        >
          <Card>
            <CardHeader>
              <CardDescription>
                آخر نتيجة ناجحة بعد التحقق من البيانات.
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
                    {isSubmitting ? "جارٍ الإرسال…" : "إرسال ومراجعة البيانات"}
                  </Button>
                )}
              </form.Subscribe>
              <div aria-live="polite" aria-atomic="true" className="min-w-0">
                {submitted ? (
                  <div className="flex min-w-0 flex-col gap-3">
                    <Badge variant="secondary">التحقق ناجح</Badge>
                    <p className="text-xs text-muted-foreground">
                      وقت الإرسال: {" "}
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
                    لم يتم إرسال بيانات بعد. استخدم أحد زري الإرسال لعرضها هنا.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                تظل الأرقام أرقامًا، والمفاتيح قيمًا منطقية، والاختيارات المتعددة قوائم. تعرض المرفقات بياناتها دون محتوى الملفات.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>حالة النموذج الحالية</CardTitle>
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
                    <dt>تم التعديل</dt>
                    <dd>{String(dirty)}</dd>
                    <dt>البيانات صحيحة</dt>
                    <dd>{String(valid)}</dd>
                    <dt>جارٍ الإرسال</dt>
                    <dd>{String(submitting)}</dd>
                    <dt>محاولات الإرسال</dt>
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
