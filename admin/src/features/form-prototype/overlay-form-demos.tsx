"use client";

import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  FormDialog,
  FormSection,
  FormSectionPanel,
  FormSectionsDialog,
  FormSheet,
  useAppForm,
} from "@/components/forms";
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

const overlayFormSchema = z.object({
  title: z.string().trim().min(3, "اكتب ٣ أحرف على الأقل."),
  sku: z.string().trim().min(3, "اكتب ٣ أحرف على الأقل."),
  category: z.enum(["apparel", "home", "accessories"]),
  price: z.number().positive("السعر لازم يكون أكبر من صفر."),
  inventory: z.number().int().min(0, "المخزون لا يمكن أن يكون أقل من صفر."),
  published: z.boolean(),
});

type OverlayFormValues = z.infer<typeof overlayFormSchema>;
type Presentation = "dialog" | "sheet" | "sections";

const presentationLabels: Record<Presentation, string> = {
  dialog: "نافذة حوارية",
  sheet: "لوحة جانبية",
  sections: "نموذج مقسّم",
};
type SavedPreview = { values: OverlayFormValues; savedAt: string };

const presentationCopy: Record<
  Presentation,
  { title: string; description: string; trigger: string }
> = {
  dialog: {
    title: "نموذج داخل نافذة",
    description: "نافذة مختصرة بأزرار ثابتة ومحتوى قابل للتمرير.",
    trigger: "فتح النافذة",
  },
  sheet: {
    title: "نموذج في لوحة جانبية",
    description: "لوحة جانبية تتيح تعديل البيانات مع إبقاء الصفحة ظاهرة.",
    trigger: "فتح اللوحة",
  },
  sections: {
    title: "نموذج مقسّم إلى أقسام",
    description: "نافذة واسعة تضم مجموعة حقول مستقلة لكل قسم في القائمة.",
    trigger: "فتح النموذج",
  },
};

const sections = [
  { id: "identity", title: "بيانات المنتج" },
  { id: "pricing", title: "السعر والمخزون" },
  { id: "publishing", title: "النشر" },
] as const;

const sectionFields: Record<string, ReadonlyArray<keyof OverlayFormValues>> = {
  identity: ["title", "sku"],
  pricing: ["price", "inventory"],
  publishing: ["category", "published"],
};

function createInitialValues(): OverlayFormValues {
  return {
    title: "حقيبة قماش يومية",
    sku: "BAG-204",
    category: "accessories",
    price: 32,
    inventory: 48,
    published: false,
  };
}

function OverlayFormDemo({ presentation }: { presentation: Presentation }) {
  const copy = presentationCopy[presentation];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failureArmed, setFailureArmed] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);
  const [submitted, setSubmitted] = useState<SavedPreview | null>(null);
  const pendingRef = useRef(false);
  const failureRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const formId = `overlay-form-${presentation}-${useId().replaceAll(":", "")}`;

  const form = useAppForm({
    defaultValues: createInitialValues(),
    validators: {
      onChange: overlayFormSchema,
      onSubmit: overlayFormSchema,
    },
    onSubmitInvalid: ({ value }) => {
      const parsed = overlayFormSchema.safeParse(value);
      if (parsed.success) return;

      const invalidFields = new Set(
        parsed.error.issues.map((issue) => String(issue.path[0] ?? ""))
      );
      const firstInvalidSection = sections.find((section) =>
        sectionFields[section.id]?.some((field) => invalidFields.has(field))
      );

      if (firstInvalidSection) setActiveSection(firstInvalidSection.id);
    },
    onSubmit: async ({ value }) => {
      if (pendingRef.current) return;

      const parsed = overlayFormSchema.safeParse(value);
      if (!parsed.success) {
        const invalidFields = new Set(
          parsed.error.issues.map((issue) => String(issue.path[0] ?? ""))
        );
        const firstInvalidSection = sections.find((section) =>
          sectionFields[section.id]?.some((field) => invalidFields.has(field))
        );
        if (firstInvalidSection) setActiveSection(firstInvalidSection.id);
        return;
      }

      pendingRef.current = true;
      setSaving(true);

      const values = parsed.data;
      const savePromise = new Promise<SavedPreview>((resolve, reject) => {
        window.setTimeout(() => {
          if (failureRef.current) {
            failureRef.current = false;
            setFailureArmed(false);
            reject(new Error("تعذّر حفظ المعاينة"));
            return;
          }

          resolve({ values, savedAt: new Date().toISOString() });
        }, 750);
      });

      toast.promise(savePromise, {
        loading: "جارٍ حفظ معاينة المنتج…",
        success: "تم حفظ معاينة المنتج",
        error: "تعذّر حفظ معاينة المنتج. ما زالت المسودة مفتوحة.",
      });

      try {
        const saved = await savePromise;
        setSubmitted(saved);
        setOpen(false);
      } catch {
        // Sonner reports the failure; the form keeps its current values.
      } finally {
        pendingRef.current = false;
        setSaving(false);
      }
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pendingRef.current) return;
    form.reset(createInitialValues());
    if (nextOpen) setActiveSection(sections[0].id);
    setOpen(nextOpen);
  };

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    wasOpenRef.current = open;
  }, [open]);

  const armFailure = () => {
    failureRef.current = true;
    setFailureArmed(true);
  };

  const formFooter = (
    <form.FormActions className="w-full justify-end">
      <form.SubmitButton formId={formId} disabled={saving}>
        حفظ
      </form.SubmitButton>
    </form.FormActions>
  );

  const identityFields = (
    <>
      <form.AppField name="title">
        {(field) => <field.Input label="اسم المنتج" disabled={saving} />}
      </form.AppField>
      <form.AppField name="sku">
        {(field) => (
          <field.GroupedInput label="كود المنتج" prefix="SKU" disabled={saving} />
        )}
      </form.AppField>
    </>
  );

  const pricingFields = (
    <>
      <form.AppField name="price">
        {(field) => (
          <field.Number
            label="السعر"
            min={0.01}
            step={0.01}
            disabled={saving}
          />
        )}
      </form.AppField>
      <form.AppField name="inventory">
        {(field) => (
          <field.Number label="المخزون" min={0} disabled={saving} />
        )}
      </form.AppField>
    </>
  );

  const publishingFields = (
    <>
      <form.AppField name="category">
        {(field) => (
          <field.Select
            label="الفئة"
            disabled={saving}
            options={[
              { value: "apparel", label: "ملابس" },
              { value: "home", label: "المنزل والمعيشة" },
              { value: "accessories", label: "إكسسوارات" },
            ]}
          />
        )}
      </form.AppField>
      <form.AppField name="published">
        {(field) => (
          <field.Checkbox
            label="نشر هذا المنتج"
            description="هذه بيانات تجريبية فقط، ولن يؤدي النشر إلى أي إجراء خارجي."
            disabled={saving}
          />
        )}
      </form.AppField>
    </>
  );

  const renderForm = () => (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {presentation === "sections" ? (
        <>
          <FormSectionPanel value="identity">
            <FormSection
              sectionId="identity"
              title="بيانات المنتج"
              description="اسم المنتج وكوده يميزانه في الكتالوج."
              fieldsClassName="grid gap-5 lg:grid-cols-2"
            >
              {identityFields}
            </FormSection>
          </FormSectionPanel>
          <FormSectionPanel value="pricing">
            <FormSection
              sectionId="pricing"
              title="السعر والمخزون"
              description="حدّد سعرًا تجريبيًا وكمية المخزون الحالية."
              fieldsClassName="grid gap-5 lg:grid-cols-2"
            >
              {pricingFields}
            </FormSection>
          </FormSectionPanel>
          <FormSectionPanel value="publishing">
            <FormSection
              sectionId="publishing"
              title="النشر"
              description="اختار فئة وحدد ما إذا كانت المعاينة منشورة أو مسودة."
              fieldsClassName="grid gap-5 lg:grid-cols-2"
            >
              {publishingFields}
            </FormSection>
          </FormSectionPanel>
        </>
      ) : (
        <FieldGroup className="grid gap-5 sm:grid-cols-2">
          {identityFields}
          {pricingFields}
          {publishingFields}
        </FieldGroup>
      )}
    </form>
  );

  return (
    <form.AppForm>
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{presentationLabels[presentation]}</Badge>
          </div>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={triggerRef}
              type="button"
              onClick={() => handleOpenChange(true)}
            >
              <Save data-icon="inline-start" />
              {copy.trigger}
            </Button>
            <Button
              type="button"
              variant={failureArmed ? "destructive" : "outline"}
              disabled={saving}
              onClick={armFailure}
            >
              {failureArmed ? "الحفظ القادم سيفشل" : "محاكاة فشل الحفظ القادم"}
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">حالة النموذج الحالية</p>
              <form.Subscribe
                selector={(state: any) =>
                  [state.isFormValid, state.isDirty] as const
                }
              >
                {([isValid, isDirty]: readonly [boolean, boolean]) => (
                  <div className="flex gap-2">
                    <Badge variant={isValid ? "secondary" : "destructive"}>
                      {isValid ? "صحيح" : "يتطلب المراجعة"}
                    </Badge>
                    <Badge variant="outline">
                      {isDirty ? "تم تعديل المسودة" : "المسودة كما هي"}
                    </Badge>
                  </div>
                )}
              </form.Subscribe>
            </div>
            <form.Subscribe selector={(state: any) => state.values}>
              {(values: OverlayFormValues) => (
                <pre className="max-h-48 overflow-auto rounded-lg bg-background p-3 text-xs">
                  {JSON.stringify(values, null, 2)}
                </pre>
              )}
            </form.Subscribe>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">آخر نتيجة ناجحة</p>
              {submitted ? (
                <span className="text-xs text-muted-foreground">
                  {new Date(submitted.savedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            {submitted ? (
              <pre className="max-h-48 overflow-auto rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(submitted.values, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                ستظهر هنا نتيجة الحفظ الناجح.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {presentation === "dialog" ? (
        <FormDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="إنشاء معاينة منتج"
          description="أكمل الحقول واحفظها في بيانات المعاينة المحلية."
          pending={saving}
          footer={formFooter}
        >
          {renderForm()}
        </FormDialog>
      ) : null}
      {presentation === "sheet" ? (
        <FormSheet
          open={open}
          onOpenChange={handleOpenChange}
          title="إنشاء معاينة منتج"
          description="عدّل النموذج مع إبقاء الصفحة ظاهرة."
          pending={saving}
          footer={formFooter}
        >
          {renderForm()}
        </FormSheet>
      ) : null}
      {presentation === "sections" ? (
        <FormSectionsDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="إنشاء معاينة منتج"
          description="اختار قسمًا من القائمة ثم احفظ النموذج كاملًا."
          pending={saving}
          sections={sections}
          value={activeSection}
          onValueChange={setActiveSection}
          footer={formFooter}
        >
          {renderForm()}
        </FormSectionsDialog>
      ) : null}
    </form.AppForm>
  );
}

export function OverlayFormDemos() {
  return (
    <section className="flex flex-col gap-6 border-t pt-10">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">مكوّنات ونماذج داخل التطبيق</Badge>
          <Badge variant="secondary">TanStack Form + Zod</Badge>
          <Badge variant="secondary">حفظ مؤقت في الذاكرة</Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          النوافذ والألواح والنماذج المقسّمة
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          لكل مثال نموذج وحقول وحالة تحقق ونتيجة محفوظة. إغلاق النافذة يلغي المسودة، وفتحها من جديد يبدأ بالقيم الافتراضية. جرّب فشل الحفظ لتتأكد أن التعديلات تظل موجودة.
        </p>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <OverlayFormDemo presentation="dialog" />
        <OverlayFormDemo presentation="sheet" />
        <OverlayFormDemo presentation="sections" />
      </div>
    </section>
  );
}
