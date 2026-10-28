import { useState } from "react";
import { arEG } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { z } from "zod";
import { useAppForm } from "@/lib/form";
import { FieldGroup } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const options = [
  { value: "books", label: "كتب" },
  { value: "stories", label: "قصص" },
];
const defaults: z.input<typeof schema> = {
  title: "رحلة جديدة",
  notes: "",
  password: "",
  quantity: 1,
  city: "",
  category: "books",
  topics: [] as string[],
  status: "draft",
  published: false,
  date: undefined as Date | undefined,
  range: undefined as DateRange | undefined,
  month: undefined as Date | undefined,
  datetime: undefined as Date | undefined,
  time: "09:00",
  timeRange: { start: "09:00", end: "10:00" },
  attachments: [] as File[],
};
const schema = z.object({
  title: z.string().trim().min(2, "اكتب حرفين على الأقل."),
  notes: z.string(),
  password: z.string(),
  quantity: z.number().int("اكتب عددًا صحيحًا.").min(1, "الحد الأدنى ١."),
  city: z.string(),
  category: z.string(),
  topics: z.array(z.string()),
  status: z.string(),
  published: z.boolean(),
  date: z.date().optional(),
  range: z
    .object({ from: z.date().optional(), to: z.date().optional() })
    .optional(),
  month: z.date().optional(),
  datetime: z.date().optional(),
  time: z.string(),
  timeRange: z
    .object({ start: z.string(), end: z.string() })
    .refine((v) => v.end > v.start, {
      message: "يجب أن تكون النهاية بعد البداية.",
    }),
  attachments: z.array(z.instanceof(File)),
});

export function AllFieldsForm() {
  const [result, setResult] = useState<string>();
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: schema },
    onSubmit: ({ value }) => {
      setResult(
        JSON.stringify(
          {
            ...value,
            attachments: value.attachments.map((file) => ({
              name: file.name,
              size: file.size,
            })),
          },
          null,
          2,
        ),
      );
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>حقول Shuip</CardTitle>
        <CardDescription>
          كل الحقول تستخدم useAppForm وسياقًا واحدًا، مع غلاف موحد وشارة توضيح.
          الحفظ تجريبي داخل الصفحة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            noValidate
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="grid gap-6 md:grid-cols-2">
              <form.AppField name="title">
                {(field) => (
                  <field.InputField
                    label="العنوان"
                    required
                    description="اسم يظهر في لوحة الإدارة."
                  />
                )}
              </form.AppField>
              <form.AppField name="quantity">
                {(field) => (
                  <field.InputField
                    label="الكمية"
                    description="عدد صحيح يبدأ من ١."
                    props={{ type: "number", min: 1, step: 1 }}
                  />
                )}
              </form.AppField>
              <form.AppField name="notes">
                {(field) => (
                  <field.TextareaField
                    label="ملاحظات"
                    description="تفاصيل إضافية اختيارية."
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.PasswordField
                    label="كلمة المرور"
                    description="مثال عرض فقط؛ لا تستخدم كلمة مرور حقيقية."
                    props={{ autoComplete: "new-password", dir: "ltr" }}
                  />
                )}
              </form.AppField>
              <form.AppField name="city">
                {(field) => (
                  <field.AutocompleteField
                    label="المدينة"
                    description="اكتب أو اختر اقتراحًا."
                    suggestions={["القاهرة", "الإسكندرية", "الجيزة"]}
                    emptyText="لا توجد نتائج"
                  />
                )}
              </form.AppField>
              <form.AppField name="category">
                {(field) => (
                  <field.SelectField
                    label="الفئة"
                    description="اختيار واحد من قائمة."
                    options={{ كتب: "books", قصص: "stories" }}
                  />
                )}
              </form.AppField>
              <form.AppField name="topics">
                {(field) => (
                  <field.ComboboxField
                    label="الموضوعات"
                    description="بحث مع اختيار متعدد؛ تُحفظ المعرفات."
                    multiple
                    options={options}
                    emptyText="لا توجد نتائج"
                  />
                )}
              </form.AppField>
              <form.AppField name="status">
                {(field) => (
                  <field.RadioField
                    label="الحالة"
                    description="اختر حالة واحدة."
                    options={[
                      { value: "draft", label: "مسودة" },
                      { value: "active", label: "نشط" },
                    ]}
                  />
                )}
              </form.AppField>
              <form.AppField name="published">
                {(field) => (
                  <field.CheckboxField
                    label="منشور"
                    description="خيار منطقي للتجربة."
                  />
                )}
              </form.AppField>
              <form.AppField name="date">
                {(field) => (
                  <field.DateField
                    label="التاريخ"
                    description="قيمة Date محلية؛ حوّلها عند حدود الـ API."
                    locale={arEG}
                    placeholder="اختر تاريخًا"
                  />
                )}
              </form.AppField>
              <form.AppField name="range">
                {(field) => (
                  <field.DateRangeField
                    label="نطاق التواريخ"
                    description="تاريخ البداية والنهاية."
                    locale={arEG}
                    placeholder="اختر نطاقًا"
                  />
                )}
              </form.AppField>
              <form.AppField name="month">
                {(field) => (
                  <field.MonthField
                    label="الشهر"
                    description="يحفظ أول يوم من الشهر المحدد."
                    locale={arEG}
                    placeholder="اختر شهرًا"
                  />
                )}
              </form.AppField>
              <form.AppField name="datetime">
                {(field) => (
                  <field.DatetimeField
                    label="التاريخ والوقت"
                    description="حدد يومًا ثم وقتًا."
                    locale={arEG}
                    placeholder="اختر موعدًا"
                  />
                )}
              </form.AppField>
              <form.AppField name="time">
                {(field) => (
                  <field.TimeField
                    label="الوقت"
                    description="قيمة نصية بتنسيق HH:mm."
                  />
                )}
              </form.AppField>
              <form.AppField name="timeRange">
                {(field) => (
                  <field.TimeRangeField
                    label="نطاق الوقت"
                    description="النهاية بعد البداية في اليوم نفسه."
                    startLabel="البداية"
                    endLabel="النهاية"
                  />
                )}
              </form.AppField>
              <form.AppField name="attachments">
                {(field) => (
                  <field.AttachmentsField
                    label="المرفقات"
                    description="إضافة محلية فقط، حتى ٥ ملفات."
                  />
                )}
              </form.AppField>
            </FieldGroup>
            <form.FormErrorSummary />
            <form.FormActions>
              <form.SubmitButton>حفظ تجريبي</form.SubmitButton>
            </form.FormActions>
          </form>
        </form.AppForm>
        {result && (
          <pre
            dir="ltr"
            className="mt-4 overflow-auto rounded-md bg-muted p-4 text-xs"
          >
            {result}
          </pre>
        )}
        <InlineEditDemo />
      </CardContent>
    </Card>
  );
}
function InlineEditDemo() {
  const [saved, setSaved] = useState("عنوان قابل للتعديل");
  const form = useAppForm({
    defaultValues: { title: saved },
    onSubmit: ({ value }) => {
      setSaved(value.title);
    },
  });
  return (
    <div className="mt-6 flex flex-col gap-3">
      <form.AppForm>
        <form.AppField
          name="title"
          validators={{
            onChange: ({ value }) =>
              value.trim().length < 2 ? "اكتب حرفين على الأقل." : undefined,
          }}
        >
          {(field) => (
            <field.InlineEditField
              label="تعديل مباشر"
              description="انقر للتعديل؛ Enter يحفظ وEscape يلغي. الحفظ محلي."
            />
          )}
        </form.AppField>
      </form.AppForm>
      <p className="text-sm text-muted-foreground" role="status">
        آخر قيمة محفوظة: {saved}
      </p>
    </div>
  );
}
