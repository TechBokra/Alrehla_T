"use client";

import { Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AllFieldsForm } from "./all-fields-form";
import { RefineFormDemo } from "./refine-demo";

const compositionExample = `import { useAppForm } from "@/lib/form"

const form = useAppForm({
  defaultValues,
  validators: { onChange: schema, onSubmit: schema },
  onSubmit: async ({ value }) => onFinish(value),
})

return (
  <form.AppForm>
    <form onSubmit={(event) => {
      event.preventDefault()
      void form.handleSubmit()
    }}>
      <form.AppField name="title">
        {(field) => <field.InputField label="اسم المنتج" />}
      </form.AppField>
      <form.FormActions>
        <form.SubmitButton>حفظ</form.SubmitButton>
      </form.FormActions>
    </form>
  </form.AppForm>
)`;

export function FormPrototypePage() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">نموذج تجريبي · محلي</Badge>
          <Badge variant="secondary">TanStack Form</Badge>
          <Badge variant="secondary">Refine</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          نماذج قابلة لإعادة الاستخدام
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          جرّب حقول TanStack المرتبطة بالنموذج، ثم شاهد كيف يربط Refine القيم التي تم التحقق منها بعمليات الإنشاء والتعديل. كل السجلات وعمليات الحفظ هنا تجريبية ومحلية.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="text-primary" />
            <CardTitle>طريقة تركيب النموذج</CardTitle>
          </div>
          <CardDescription>
            يتم التحقق من اسم الحقل ومطابقته لقيم النموذج، ويقرأ كل مكوّن قيمته من سياق الحقل المرتبط به.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed sm:text-sm">
            {compositionExample}
          </pre>
        </CardContent>
      </Card>

      <AllFieldsForm />
      <div className="border-t pt-10">
        <RefineFormDemo />
      </div>
    </div>
  );
}
