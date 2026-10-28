import { BaseFormField } from "@/components/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function BaseFieldDemo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الشكل المشترك للحقول</CardTitle>
        <CardDescription>
          عنوان ومساعدة بجواره، علامة للحقل المطلوب، وخطأ أسفل الإدخال. افتح
          المساعدة بالمرور على الأيقونة أو بالتركيز عليها بلوحة المفاتيح.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-6 md:grid-cols-2">
          <BaseFormField
            label="اسم المنتج"
            required
            description={
              <>
                اكتب اسمًا واضحًا. يظهر في <strong>الكتالوج</strong> وصفحة
                المنتج.
              </>
            }
          >
            {(control) => (
              <Input {...control} placeholder="مثال: حكاية الرحلة" dir="auto" />
            )}
          </BaseFormField>
          <BaseFormField
            label="البريد الإلكتروني"
            description="استخدم البريد الذي يستقبل رسائل الحساب."
            invalid
            error="اكتب بريدًا إلكترونيًا صالحًا."
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                dir="ltr"
                defaultValue="example"
              />
            )}
          </BaseFormField>
          <BaseFormField
            label="رقم الطلب"
            description="يحدده النظام عند إنشاء الطلب."
            disabled
          >
            {(control) => (
              <Input {...control} defaultValue="ORDER-1024" dir="ltr" />
            )}
          </BaseFormField>
          <BaseFormField
            ariaLabel="البحث بالاسم"
            description="مثال لحقل بلا عنوان ظاهر مع مساعدة متاحة."
          >
            {(control) => (
              <Input
                {...control}
                type="search"
                placeholder="ابحث بالاسم…"
                dir="auto"
              />
            )}
          </BaseFormField>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
