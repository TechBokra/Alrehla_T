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
    { value: "accessories", label: "إكسسوارات" },
    { value: "home", label: "المنزل والمعيشة" },
    { value: "apparel", label: "ملابس" },
  ],
  status: [
    { value: "draft", label: "مسودة" },
    { value: "active", label: "نشط" },
    { value: "archived", label: "مؤرشف" },
  ],
  channels: [
    { value: "storefront", label: "المتجر الإلكتروني" },
    { value: "marketplace", label: "سوق إلكتروني" },
    { value: "pos", label: "نقطة البيع" },
  ],
  layout: [
    { value: "grid", label: "شبكة" },
    { value: "list", label: "قائمة" },
    { value: "compact", label: "مضغوط" },
  ],
  placements: [
    { value: "storefront", label: "المتجر الإلكتروني" },
    { value: "email", label: "البريد الإلكتروني" },
    { value: "social", label: "منصات التواصل" },
  ],
  tags: [
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
    { value: "sale", label: "تخفيض", description: "ضمن عرض حالي" },
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
          <Badge variant="outline">إنشاء خطّاف للنموذج</Badge>
          <Badge variant="secondary">TanStack Form + Zod</Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          كل الحقول في نموذج واحد
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          كل عنصر مرتبط بالنموذج المحلي. عدّل القيم وراجع حالة النموذج ثم أرسله لمشاهدة النتيجة. تظل المرفقات في ذاكرة المتصفح ولا يتم رفعها.
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
                <CardTitle>النصوص والأرقام والتواريخ</CardTitle>
                <CardDescription>
                  تتغير عناصر الحقول نفسها حسب نوع القيمة. تظهر المساعدة بجوار
                  العنوان، أو أسفل العنصر إذا لم يكن له عنوان ظاهر.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="title">
                    {(field) => (
                      <field.Input
                        label="اسم المنتج · إدخال نصي"
                        description="اكتب اسمًا واضحًا يظهر للعملاء في الكتالوج وصفحات المنتجات."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="email">
                    {(field) => <field.Input label="البريد الإلكتروني" type="email" />}
                  </form.AppField>
                  <form.AppField name="password">
                    {(field) => (
                      <field.Input label="كلمة مرور تجريبية" type="password" />
                    )}
                  </form.AppField>
                  <form.AppField name="search">
                    {(field) => (
                      <field.GroupedInput
                        ariaLabel="بحث · مجموعة الإدخال"
                        description="ابحث باسم المنتج أو كوده. تظهر المساعدة أسفل الحقل عند عدم كتابة عنوان له."
                        prefix="بحث"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="website">
                    {(field) => (
                      <field.Input label="الموقع الإلكتروني · رابط" type="url" />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => <field.Input label="رقم الهاتف" type="tel" />}
                  </form.AppField>
                  <form.AppField name="quantity">
                    {(field) => (
                      <field.Number
                        label="الكمية · رقم"
                        min={1}
                        max={10000}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="price">
                    {(field) => (
                      <field.Number label="السعر" min={0} step={0.01} />
                    )}
                  </form.AppField>
                  <form.AppField name="launchDate">
                    {(field) => <field.Date label="تاريخ الإطلاق · تاريخ" />}
                  </form.AppField>
                  <form.AppField name="launchTime">
                    {(field) => <field.Time label="وقت الإطلاق · وقت" />}
                  </form.AppField>
                  <form.AppField name="color">
                    {(field) => <field.Color label="اللون المميز · لون" />}
                  </form.AppField>
                  <form.AppField name="verificationCode">
                    {(field) => <field.OTP label="رمز التحقق · لمرة واحدة" />}
                  </form.AppField>
                </FieldGroup>
                <div className="mt-5">
                  <form.AppField name="description">
                    {(field) => (
                      <field.Textarea label="الوصف · نص متعدد الأسطر" rows={4} />
                    )}
                  </form.AppField>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الاختيارات والوسوم</CardTitle>
                <CardDescription>
                  أمثلة لقوائم الاختيار والقوائم الأصلية والبحث والوسوم بمربعات
                  التحديد.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="collection">
                    {(field) => (
                      <field.Select
                        label="المجموعة · قائمة اختيار"
                        options={choices.collection}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="status">
                    {(field) => (
                      <field.NativeSelect
                        label="الحالة · قائمة أصلية"
                        options={choices.status}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="category">
                    {(field) => (
                      <field.Combobox
                        label="الفئة · بحث واختيار"
                        options={choices.collection}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="channels">
                    {(field) => (
                      <field.CheckboxGroup
                        label="قنوات البيع · مربعات تحديد"
                        description="اختار الأماكن التي يمكن للعملاء العثور على المنتج أو شراؤه منها."
                        options={choices.channels}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="publishingStatus">
                    {(field) => (
                      <field.RadioGroup
                        label="حالة النشر · أزرار اختيار"
                        description="المسودة مخفية، والنشط متاح، والمؤرشف لم يعد مستخدمًا."
                        options={choices.status}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="tags">
                    {(field) => (
                      <field.Tags
                        label="وسوم المنتج · قائمة قابلة للبحث"
                        options={[...choices.tags]}
                        maxVisibleTags={2}
                        description="اختار من وسم إلى ٥ وسوم. تظهر الاختيارات الإضافية كرقم، وتظل كل المعرفات ضمن البيانات."
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مفاتيح التحكم والاختيارات المركّبة</CardTitle>
                <CardDescription>
                  مربعات التحديد والمفاتيح وشرائط التمرير ومجموعات الاختيار
                  الفردية أو المتعددة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <form.AppField name="published">
                    {(field) => (
                      <field.Checkbox
                        label="منشور · مربع تحديد"
                        description="يمكن أن تظهر المنتجات المنشورة في قنوات البيع المتاحة."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="notifications">
                    {(field) => (
                      <field.Switch
                        label="التنبيهات · مفتاح"
                        description="أرسل تنبيهًا عند تغيير معاينة المنتج."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="discount">
                    {(field) => (
                      <field.Slider
                        label="الخصم · شريط التمرير"
                        min={0}
                        max={100}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="featured">
                    {(field) => (
                      <field.Toggle
                        ariaLabel="تفعيل المنتج المميز"
                        description="ضع المنتج ضمن المنتجات المميزة. تظهر المساعدة أسفل الحقل عند عدم كتابة عنوان له."
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="layout">
                    {(field) => (
                      <field.ToggleGroup
                        label="طريقة العرض · اختيار واحد"
                        description="اختار طريقة ظهور المنتجات في معاينة الكتالوج."
                        options={choices.layout}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="placements">
                    {(field) => (
                      <field.ToggleGroup
                        label="أماكن الظهور · اختيار متعدد"
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
                <CardTitle>المرفقات</CardTitle>
                <CardDescription>
                  اختر حتى خمسة ملفات ثم أزل كل ملف على حدة. لا يتم رفع أي ملف.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form.AppField name="attachments">
                  {(field) => (
                    <field.Attachments
                      label="إرفاق ملفات"
                      maxFiles={5}
                      description="تظل الملفات في ذاكرة علامة التبويب الحالية. تحتوي النتيجة على بيانات الملفات فقط."
                    />
                  )}
                </form.AppField>
              </CardContent>
            </Card>

            <form.FormErrorSummary />
            <form.FormActions>
              <form.SubmitButton>تحقق وأرسل</form.SubmitButton>
              <form.ResetButton>إعادة ضبط القيم</form.ResetButton>
              <form.UnsavedChangesIndicator />
            </form.FormActions>
          </form>
        </form.AppForm>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle>الحالة الحالية</CardTitle>
              <CardDescription>
                تتحدث القيم والتحققات أثناء تعديل النموذج.
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
                        {isFormValid ? "صالح" : "يحتاج إلى مراجعة"}
                      </Badge>
                      <Badge variant="outline">
                        {isSubmitting ? "جارٍ الإرسال" : "جاهز"}
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
              <CardTitle>آخر إرسال ناجح</CardTitle>
              <CardDescription>
                ستظل آخر نتيجة ظاهرة عند وجود أخطاء في الإرسال.
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
                  أرسل نموذجًا صحيحًا لعرض قيمه بصيغة JSON.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
